import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { errors } from 'telegram';
import { checkRateLimit, handleTelegramError, handleErrorResponse } from '@/lib/apiUtils';

export async function POST(req) {
  let client;
  try {
    console.log('[START]: Extracting data');
    const { apiId, apiHash, phoneNumber, extractType, validationCode, phoneCodeHash } = await req.json();

    console.log('[DEBUG]: Received payload:', { 
      apiId, apiHash, phoneNumber, extractType, 
      validationCode: validationCode ? 'Provided' : 'Not provided',
      phoneCodeHash: phoneCodeHash ? 'Provided' : 'Not provided'
    });

    // Input Validation
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      return handleErrorResponse('API ID is invalid or missing. Please provide a valid positive number.', 400);
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      return handleErrorResponse('API Hash is invalid. It should be a 32-character hexadecimal string.', 400);
    }
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
      return handleErrorResponse('Phone number is missing or invalid. Please enter a valid phone number.', 400);
    }

    const validPhoneNumber = phoneNumber.trim();
    console.log('[DEBUG]: Valid phone number:', validPhoneNumber);

    checkRateLimit(); // Check if we're within rate limits

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
          phone: validPhoneNumber,
        });

        console.log('[SUCCESS]: Validation code requested successfully');
        return NextResponse.json({
          success: true,
          message: 'Validation code sent to your phone. Please provide it in the next step.',
          requiresValidation: true,
          phoneCodeHash: newPhoneCodeHash,
        });
      } catch (error) {
        return handleTelegramError(error);
      }
    }

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
      return handleTelegramError(error);
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
