import { NextResponse } from 'next/server';
import { MTProto } from 'telegram-mtproto';
import { supabase } from '@/lib/supabase';

const api = {
  invokeWithLayer: 0xda9b0d0d,
  layer: 57,
  initConnection: 0x69796de9,
  api_id: process.env.TELEGRAM_API_ID,
  api_hash: process.env.TELEGRAM_API_HASH,
  app_version: '1.0.1',
  lang_code: 'en'
};

const server = {
  dev: true
};

const client = MTProto({ api, server });

export async function POST(req) {
  try {
    const { phoneNumber, extractType } = await req.json();

    const { phone_code_hash } = await client('auth.sendCode', {
      phone_number: phoneNumber,
      current_number: false,
      api_id: api.api_id,
      api_hash: api.api_hash
    });

    // Note: In a real-world scenario, you'd need to implement a way to get the code from the user
    // For this example, we'll use a placeholder
    const code = '12345';

    const { user } = await client('auth.signIn', {
      phone_number: phoneNumber,
      phone_code_hash: phone_code_hash,
      phone_code: code
    });

    let extractedData;
    if (extractType === 'groups') {
      const chats = await client('messages.getDialogs', {
        offset_date: 0,
        offset_id: 0,
        offset_peer: { _: 'inputPeerEmpty' },
        limit: 100
      });
      extractedData = chats.chats.map(chat => ({
        id: chat.id.toString(),
        title: chat.title,
        participants_count: chat.participants_count || 0,
        description: chat.about || '',
      }));
    } else if (extractType === 'contacts') {
      const contacts = await client('contacts.getContacts');
      extractedData = contacts.users.map(user => ({
        id: user.id.toString(),
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone,
        username: user.username,
      }));
    } else {
      throw new Error(`Invalid extractType: ${extractType}`);
    }

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