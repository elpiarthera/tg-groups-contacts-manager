import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { apiId, apiHash, phoneNumber, extractType } = await req.json();

    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => '',
      phoneCode: async () => '',
      onError: (err) => console.log(err),
    });

    let extractedData;
    if (extractType === 'groups') {
      const dialogs = await client.getDialogs();
      extractedData = dialogs.map(dialog => ({
        id: dialog.id.toString(),
        title: dialog.title,
        participants_count: dialog.participantsCount || 0,
        description: dialog.about || '',
      }));
    } else if (extractType === 'contacts') {
      const contacts = await client.getContacts();
      extractedData = contacts.map(contact => ({
        id: contact.id.toString(),
        first_name: contact.firstName,
        last_name: contact.lastName,
        phone_number: contact.phone,
        username: contact.username,
      }));
    } else {
      throw new Error(`Invalid extractType: ${extractType}`);
    }

    await client.disconnect();

    const { data, error } = await supabase
      .from(extractType)
      .upsert(extractedData, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `Data extracted and stored for ${extractType}`,
      count: extractedData.length
    });
  } catch (error) {
    console.error('Error in extract-data API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unknown error occurred'
    }, { status: 500 });
  }
}