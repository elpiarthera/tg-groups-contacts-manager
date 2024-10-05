import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { PhoneNumberInvalidError, FloodWaitError, PhoneCodeExpiredError, PhoneCodeInvalidError, ApiIdInvalidError } from 'telegram/errors';

function handleErrorResponse(message, status = 500) {
  console.error('[ERROR RESPONSE]:', message);
  return NextResponse.json({
    success: false,
    error: { code: status, message },
  }, { status });
}

async function retryAsync(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof FloodWaitError) {
        console.warn(`[FLOOD WAIT]: Waiting for ${err.seconds} seconds.`);
        await new Promise(resolve => setTimeout(resolve, err.seconds * 1000));
      } else if (err instanceof PhoneNumberInvalidError) {
        console.error('[PHONE NUMBER ERROR]:', err);
        throw err; // Don't retry for invalid phone numbers
      } else {
        console.warn(`[RETRY]: Attempt ${i + 1} failed. Error:`, err);
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  }
}

export async function POST(req) {
  let client;
  try {
    console.log('[START]: Extracting data');
    const { apiId, apiHash, phoneNumber: rawPhoneNumber, extractType, validationCode, existingSessionString } = await req.json();

    console.log('[DEBUG]: Received payload:', { apiId, apiHash, phoneNumber: rawPhoneNumber, extractType, validationCode: validationCode ? 'Provided' : 'Not provided', existingSessionString: existingSessionString ? 'Exists' : 'Not provided' });

    // Input validation
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      return handleErrorResponse('API ID is invalid or missing. Please provide a valid positive number.', 400);
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      return handleErrorResponse('API Hash is invalid. It should be a 32-character hexadecimal string.', 400);
    }
    if (!rawPhoneNumber || typeof rawPhoneNumber !== 'string' || rawPhoneNumber.trim() === '') {
      return handleErrorResponse('Phone number is missing or invalid. Please enter a valid phone number.', 400);
    }

    const validPhoneNumber = rawPhoneNumber.trim();
    console.log('[DEBUG]: Valid phone number:', validPhoneNumber);

    const stringSession = new StringSession(existingSessionString || '');
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    console.log('[PROCESS]: Connecting to Telegram');
    await client.connect();

    if (!validationCode) {
      console.log('[PROCESS]: Requesting validation code');
      try {
        const { phoneCodeHash } = await retryAsync(async () => {
          console.log('[DEBUG]: Sending code for phone number:', validPhoneNumber);
          return await client.sendCode({
            apiId: parseInt(apiId),
            apiHash,
            phoneNumber: validPhoneNumber,
          });
        });
        
        console.log('[SUCCESS]: Validation code requested successfully');
        return NextResponse.json({
          success: true,
          message: 'Validation code sent to your phone. Please provide it in the next step.',
          requiresValidation: true,
          phoneCodeHash,
        });
      } catch (error) {
        console.error('[REQUEST CODE ERROR]:', error);
        if (error instanceof PhoneNumberInvalidError) {
          return handleErrorResponse('Invalid phone number. Please check and try again.', 400);
        }
        return handleErrorResponse('Failed to send the validation code. Please try again.', 500);
      }
    } else {
      console.log('[PROCESS]: Starting Telegram client session');
      try {
        await client.start({
          phoneNumber: async () => validPhoneNumber,
          password: async () => '',
          phoneCode: async () => validationCode,
          onError: (err) => {
            console.error('[TELEGRAM CLIENT ERROR]:', err);
            throw err;
          },
        });

        console.log('[SUCCESS]: Telegram client session started successfully');

        // Extract data based on extractType
        let extractedData = [];
        if (extractType === 'groups') {
          const dialogs = await client.getDialogs();
          extractedData = dialogs.map(dialog => ({
            id: dialog.id.toString(),
            name: dialog.title,
            memberCount: dialog.participantsCount || 0,
            type: dialog.isChannel ? 'channel' : 'group',
            isPublic: !!dialog.username,
          }));
        } else if (extractType === 'contacts') {
          const contacts = await client.getContacts();
          extractedData = contacts.map(contact => ({
            id: contact.id.toString(),
            name: `${contact.firstName} ${contact.lastName}`.trim(),
            username: contact.username,
            phoneNumber: contact.phone,
            isMutualContact: contact.mutualContact,
          }));
        }

        console.log(`[SUCCESS]: Extracted ${extractedData.length} ${extractType}`);

        return NextResponse.json({
          success: true,
          items: extractedData,
          sessionString: client.session.save(),
          sessionExpiresIn: '7 days',
        });
      } catch (error) {
        console.error('[VALIDATION ERROR]: Error starting client session:', error);
        if (error instanceof PhoneCodeExpiredError) {
          return handleErrorResponse('The verification code has expired. Please request a new code.', 400);
        } else if (error instanceof PhoneCodeInvalidError) {
          return handleErrorResponse('The verification code is incorrect. Please try again.', 400);
        } else if (error instanceof ApiIdInvalidError) {
          return handleErrorResponse('The API ID or API Hash is invalid. Please check your credentials.', 400);
        }
        return handleErrorResponse('An unexpected error occurred. Please try again later.', 500);
      }
    }
  } catch (error) {
    console.error('[GENERAL API ERROR]: Error in extract-data API:', error);
    return handleErrorResponse('An unexpected error occurred. Please try again later.');
  } finally {
    if (client) {
      try {
        await client.disconnect();
        console.log('[CLEANUP]: Telegram client disconnected successfully');
      } catch (disconnectError) {
        console.error('[DISCONNECT ERROR]: Error disconnecting Telegram client:', disconnectError);
      }
    }
  }
}