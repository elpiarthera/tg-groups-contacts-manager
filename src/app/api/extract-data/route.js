import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
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

    checkRateLimit();

    const stringSession = new StringSession('');
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    console.log('[PROCESS]: Connecting to Telegram');
    await client.connect();

    if (!client.connected) {
      throw new Error('Failed to connect to Telegram');
    }

    if (!validationCode) {
      console.log('[PROCESS]: Requesting validation code');
      try {
        const result = await client.sendCode(
          {
            apiId: parseInt(apiId),
            apiHash: apiHash,
          },
          validPhoneNumber
        );
        console.log('[SUCCESS]: Validation code requested successfully');
        return NextResponse.json({
          success: true,
          message: 'Validation code sent to your phone. Please provide it in the next step.',
          requiresValidation: true,
          phoneCodeHash: result.phoneCodeHash,
        });
      } catch (error) {
        console.error('[SEND CODE ERROR]:', error);
        return handleTelegramError(error);
      }
    } else {
      console.log('[PROCESS]: Attempting to sign in with provided code');
      try {
        await client.invoke(new Api.auth.SignIn({
          phoneNumber: validPhoneNumber,
          phoneCodeHash: phoneCodeHash,
          phoneCode: validationCode
        }));
        console.log('[SUCCESS]: Signed in successfully');

        // Perform data extraction here based on extractType
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

        return NextResponse.json({
          success: true,
          items: extractedData,
          sessionString: client.session.save(),
        });
      } catch (error) {
        console.error('[SIGN IN ERROR]:', error);
        return handleTelegramError(error);
      }
    }
  } catch (error) {
    console.error('[GENERAL API ERROR]: Error in extract-data API:', error);
    return handleErrorResponse('An unexpected error occurred. Please try again later.', 500, error);
  } finally {
    if (client && client.connected) {
      try {
        await client.disconnect();
        console.log('[CLEANUP]: Telegram client disconnected successfully');
      } catch (disconnectError) {
        console.error('[DISCONNECT ERROR]: Error disconnecting Telegram client:', disconnectError);
      }
    }
  }
}
