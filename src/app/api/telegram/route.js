import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  const { apiId, apiHash, phoneNumber } = await req.json();

  const stringSession = new StringSession(''); // You can save the session string to avoid logging in every time
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: phoneNumber,
      password: async () => await input.text('Please enter your password: '),
      phoneCode: async () => await input.text('Please enter the code you received: '),
      onError: (err) => console.log(err),
    });

    const groups = await client.getDialogs();
    const groupsData = groups.map(group => ({
      id: group.id,
      group_name: group.title,
      description: group.about || '',
      invite_link: group.inviteLink || '',
    }));

    // Upsert groups data to Supabase
    const { data, error } = await supabase
      .from('groups')
      .upsert(groupsData, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Groups fetched and updated successfully' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await client.disconnect();
  }
}
