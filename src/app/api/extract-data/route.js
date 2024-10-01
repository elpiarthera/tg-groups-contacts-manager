import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleTelegramError } from '@/lib/apiUtils';

export async function POST(req) {
  try {
    console.log('Extracting data: Start');
    const { apiId, apiHash, phoneNumber, extractType, validationCode } = await req.json();
    console.log(`Received request for ${extractType} extraction`);
    console.log(`Validation code received: ${validationCode}`);

    // Lazy-load the Telegram client and StringSession only when needed
    const { TelegramClient } = await import('telegram');
    const { StringSession } = await import('telegram/sessions');

    console.log('Initializing Telegram client...');
    const stringSession = new StringSession(''); 
    const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    if (!validationCode) {
      // First step: Request the code
      console.log('Requesting validation code...');
      await client.connect();
      await client.sendCode({
        apiId: parseInt(apiId),
        apiHash: apiHash,
        phoneNumber: phoneNumber,
      });

      console.log('Validation code requested successfully');
      return NextResponse.json({
        success: true,
        message: 'Validation code sent to your phone. Please provide it in the next step.',
        requiresValidation: true
      });
    }

    console.log('Starting Telegram client session...');
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => '',
      phoneCode: async () => {
        if (!validationCode) {
          console.error('Validation code is empty');
          throw new Error('Validation code is required');
        }
        return validationCode;
      },
      onError: (err) => {
        console.error('Telegram client error:', err);
        throw new Error('Telegram client failed to start');
      },
    });
    console.log('Telegram client session started successfully');

    let extractedData = [];
    
    if (extractType === 'groups') {
      console.log('Fetching groups...');
      const dialogs = await client.getDialogs();
      extractedData = dialogs.map(dialog => ({
        id: dialog.id.toString(),
        group_name: dialog.title,
        participant_count: dialog.participantsCount || 0,
        description: dialog.about || '',
        invite_link: dialog.inviteLink || '',
        type: dialog.isChannel ? 'channel' : 'group',
      }));
      console.log(`Fetched ${extractedData.length} groups`);

      console.log('Inserting groups into Supabase...');
      const { error } = await supabase
        .from('groups')
        .upsert(extractedData, { onConflict: ['id', 'user_id'] });

      if (error) {
        console.error('Supabase insertion error:', error);
        throw error;
      }
      console.log('Groups inserted successfully');

    } else if (extractType === 'contacts') {
      console.log('Fetching contacts...');
      const contacts = await client.getContacts();
      extractedData = contacts.map(contact => ({
        id: contact.id.toString(),
        first_name: contact.firstName,
        last_name: contact.lastName,
        phone_number: contact.phone,
        username: contact.username,
        bio: contact.bio || '',
        is_bot: contact.bot || false,
      }));
      console.log(`Fetched ${extractedData.length} contacts`);

      console.log('Inserting contacts into Supabase...');
      const { error } = await supabase
        .from('contacts')
        .upsert(extractedData, { onConflict: ['id', 'user_id'] });

      if (error) {
        console.error('Supabase insertion error:', error);
        throw error;
      }
      console.log('Contacts inserted successfully');

    } else {
      throw new Error(`Invalid extractType: ${extractType}`);
    }

    console.log('Disconnecting Telegram client...');
    await client.disconnect();
    console.log('Telegram client disconnected');

    console.log('Extraction completed successfully');
    return NextResponse.json({
      success: true,
      message: `Data extracted and stored for ${extractType}`,
      count: extractedData.length
    });

  } catch (error) {
    console.error('Error in extract-data API:', error);
    await handleTelegramError(error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An unknown error occurred'
    }, { status: 500 });
  }
}
