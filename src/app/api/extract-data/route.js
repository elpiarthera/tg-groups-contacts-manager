import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleTelegramError } from '@/lib/apiUtils';

export async function POST(req) {
  try {
    const { apiId, apiHash, phoneNumber, extractType } = await req.json();

    // Lazy-load the Telegram client and StringSession only when needed
    const { TelegramClient } = await import('telegram');
    const { StringSession } = await import('telegram/sessions');

    // Initialize the Telegram client
    const stringSession = new StringSession(''); 
    const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    // Start the Telegram client session
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => '',
      phoneCode: async () => '', // handle verification codes if needed
      onError: (err) => console.log(err),
    });

    let extractedData = [];
    
    if (extractType === 'groups') {
      // Fetch groups
      const dialogs = await client.getDialogs();
      extractedData = dialogs.map(dialog => ({
        id: dialog.id.toString(),
        group_name: dialog.title,
        participant_count: dialog.participantsCount || 0,
        description: dialog.about || '',
        invite_link: dialog.inviteLink || '',
        type: dialog.isChannel ? 'channel' : 'group',
      }));

      // Insert groups into Supabase
      const { error } = await supabase
        .from('groups')
        .upsert(extractedData, { onConflict: ['id', 'user_id'] });

      if (error) throw error;

    } else if (extractType === 'contacts') {
      // Fetch contacts
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

      // Insert contacts into Supabase
      const { error } = await supabase
        .from('contacts')
        .upsert(extractedData, { onConflict: ['id', 'user_id'] });

      if (error) throw error;

    } else {
      throw new Error(`Invalid extractType: ${extractType}`);
    }

    await client.disconnect(); // Disconnect the client session

    return NextResponse.json({
      success: true,
      message: `Data extracted and stored for ${extractType}`,
      count: extractedData.length
    });

  } catch (error) {
    console.error('Error in extract-data API:', error);
    await handleTelegramError(error); // Handle rate limit error
    return NextResponse.json({
      success: false,
      error: error.message || 'An unknown error occurred'
    }, { status: 500 });
  }
}

