import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    // Check authenticity of the request
    const checkString = Object.entries({ auth_date, first_name, id, username })
      .sort()
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secret = crypto.createHash('sha256').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (expectedHash !== hash) {
      return NextResponse.json({ error: 'Invalid data from Telegram' }, { status: 400 });
    }

    // Upsert user into Supabase
    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        telegram_id: id,
        first_name,
        last_name,
        username,
        photo_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
