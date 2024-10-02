import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

export async function POST(req) {
  try {
    console.log('Extracting data: Start');
    const { apiId, apiHash, phoneNumber, extractType, validationCode } = await req.json();

    // Validate phoneNumber
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      console.error('Phone number is undefined or not a valid string');
      return NextResponse.json({
        success: false,
        error: 'Invalid or missing phone number',
      }, { status: 400 });
    }

    console.log(`Received request for ${extractType} extraction`);
    console.log(`Phone number: ${phoneNumber}`);
    console.log(`Validation code received: ${validationCode}`);

    // Lazy-load the Telegram client and StringSession only when needed
    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    if (!validationCode) {
      // First step: Request the code
      console.log('Requesting validation code...');
      await client.connect();

      try {
        const { phoneCodeHash } = await client.sendCode({
          apiId: parseInt(apiId),
          apiHash,
          phoneNumber,
        });

        console.log('Validation code requested successfully');
        return NextResponse.json({
          success: true,
          message: 'Validation code sent to your phone. Please provide it in the next step.',
          requiresValidation: true,
          phoneCodeHash,
        });
      } catch (error) {
        console.error('Error while sending code:', error);

        // Dynamically import the specific Telegram errors
        const { PhoneNumberInvalidError } = await import('telegram/errors');

        if (error instanceof PhoneNumberInvalidError) {
          return NextResponse.json({
            success: false,
            error: 'Invalid phone number. Please check and try again.',
          }, { status: 400 });
        }
        throw error; // Re-throw other errors
      }
    }

    console.log('Starting Telegram client session...');
    try {
      await client.start({
        phoneNumber: async () => phoneNumber,
        password: async () => '',
        phoneCode: async () => validationCode,
        onError: (err) => {
          console.error('Telegram client error:', err);
          throw err;
        },
      });
      console.log('Telegram client session started successfully');

      // Extract data based on extractType
      let extractedData = [];
      if (extractType === 'groups') {
        const dialogs = await client.getDialogs();
        extractedData = dialogs.map(dialog => ({
          id: dialog.id.toString(),
          name: dialog.title,
          memberCount: dialog.participantsCount || 0,
        }));
      } else if (extractType === 'contacts') {
        const contacts = await client.getContacts();
        extractedData = contacts.map(contact => ({
          id: contact.id.toString(),
          name: `${contact.firstName} ${contact.lastName}`.trim(),
          username: contact.username,
          phoneNumber: contact.phone,
        }));
      }

      console.log(`Extracted ${extractedData.length} ${extractType}`);

      return NextResponse.json({
        success: true,
        items: extractedData,
      });

    } catch (error) {
      console.error('Error starting Telegram client:', error);
      return NextResponse.json({
        success: false,
        error: error.message || 'Failed to start Telegram client',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in extract-data API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An unknown error occurred',
    }, { status: 500 });
  }
}
