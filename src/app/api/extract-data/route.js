import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { errors } from 'telegram';

export async function POST(req) {
  let client;
  try {
    console.log('[START]: Extracting data');
    const { apiId, apiHash, phoneNumber, extractType, validationCode, phoneCodeHash } = await req.json();

    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      return handleErrorResponse('API ID is invalid or missing. Please provide a valid positive number.', 400);
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      return handleErrorResponse('API Hash is invalid. It should be a 32-character hexadecimal string.', 400);
    }
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
      return handleErrorResponse('Phone number is missing or invalid. Please enter a valid phone number.', 400);
    }

    const stringSession = new StringSession('');
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    console.log('[PROCESS]: Connecting to Telegram');
    await client.connect();

    if (!validationCode) {
      console.log('[PROCESS]: Requesting validation code');
      try {
        const { phoneCodeHash: newPhoneCodeHash } = await client.sendCode({
          apiId: parseInt(apiId),
          apiHash,
          phoneNumber,
        });

        console.log('[SUCCESS]: Validation code requested successfully');
        return NextResponse.json({
          success: true,
          message: 'Validation code sent to your phone. Please provide it in the next step.',
          requiresValidation: true,
          phoneCodeHash: newPhoneCodeHash,
        });
      } catch (error) {
        console.error('[REQUEST CODE ERROR]:', error);
        if (error instanceof errors.PhoneNumberInvalidError) {
          return handleErrorResponse('Invalid phone number. Please check and try again.', 400, error);
        }
        return handleErrorResponse('Failed to send the validation code. Please try again.', 500, error);
      }
    }

    console.log('[PROCESS]: Starting Telegram client session');
    try {
      await client.start({
        phoneNumber: async () => phoneNumber,
        password: async () => '',
        phoneCode: async () => validationCode,
        onError: (err) => {
          console.error('[TELEGRAM CLIENT ERROR]:', err);
          throw err;
        },
      });

      console.log('[SUCCESS]: Telegram client session started successfully');

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
      if (error instanceof errors.PhoneCodeExpiredError) {
        return handleErrorResponse('The verification code has expired. Please request a new code.', 400, error);
      }
      return handleErrorResponse('An unexpected error occurred. Please try again later.', 500, error);
    }
  } catch (error) {
    console.error('[GENERAL API ERROR]: Error in extract-data API:', error);
    return handleErrorResponse('An unexpected error occurred. Please try again later.', 500, error);
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

function handleErrorResponse(message, status = 500, error = null) {
  console.error('[ERROR RESPONSE]:', message);
  if (error && typeof error === 'object' && 'stack' in error) {
    console.error('[ERROR STACK]:', error.stack);
  }
  return NextResponse.json({
    success: false,
    error: { 
      code: status, 
      message,
      details: error ? error.toString() : undefined
    },
  }, { status });
}