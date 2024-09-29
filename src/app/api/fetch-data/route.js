import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

export async function POST(req) {
  try {
    const { apiId, apiHash, phoneNumber, extractType } = await req.json();
    
    if (!apiId || !apiHash || !phoneNumber || !extractType) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Initialize Telegram client
    const client = new TelegramClient(new StringSession(""), parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: phoneNumber,
      password: async () => await input.text('Please enter your password: '),
      phoneCode: async () => await input.text('Please enter the code you received: '),
      onError: (err) => console.log(err),
    });

    let data;
    if (extractType === 'groups') {
      const dialogs = await client.getDialogs();
      data = dialogs.filter(d => d.isChannel || d.isGroup).map(d => ({
        group_name: d.title,
        description: d.about || '',
        invite_link: d.inviteLink || '',
      }));
      
      // Insert data into Supabase groups table
      const { error } = await supabase.from('groups').insert(data);
      if (error) throw error;
    } else if (extractType === 'contacts') {
      const contacts = await client.getContacts();
      data = contacts.map(c => ({
        first_name: c.firstName,
        last_name: c.lastName,
        username: c.username,
        phone_number: c.phone,
        bio: c.about || '',
        online_status: c.status?._ === 'UserStatusOnline' ? 'Online' : 'Offline',
      }));
      
      // Insert data into Supabase contacts table
      const { error } = await supabase.from('contacts').insert(data);
      if (error) throw error;
    } else {
      throw new Error('Invalid extract type');
    }

    await client.disconnect();

    return NextResponse.json({ success: true, extractType });
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}