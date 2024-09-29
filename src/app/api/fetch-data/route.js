import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  const { apiId, apiHash, phoneNumber, extractType } = await req.json();

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => '',
      phoneCode: async () => '',
      onError: (err) => console.log(err),
    });

    let data;
    if (extractType === 'groups') {
      const dialogs = await client.getDialogs();
      data = dialogs.map(dialog => ({
        id: dialog.id.toString(),
        name: dialog.title,
        type: dialog.isGroup ? 'group' : 'channel',
      }));
    } else {
      const contacts = await client.getContacts();
      data = contacts.map(contact => ({
        id: contact.id.toString(),
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        username: contact.username,
        phone: contact.phone,
      }));
    }

    const { error } = await supabase.from(extractType).upsert(data, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({ success: true, message: `${extractType} fetched and updated successfully` });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await client.disconnect();
  }
}