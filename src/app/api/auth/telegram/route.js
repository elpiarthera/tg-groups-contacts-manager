import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * @typedef {import('next/server').NextRequest} NextRequest
 * @typedef {import('next/server').NextResponse} NextResponse
 * @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient
 */

/**
 * @typedef {Object} TelegramAuthData
 * @property {number} id - User ID from Telegram.
 * @property {string} [first_name] - User's first name.
 * @property {string} [last_name] - User's last name.
 * @property {string} [username] - User's username.
 * @property {string} [photo_url] - URL of user's photo.
 * @property {number} auth_date - Authentication date timestamp.
 * @property {string} hash - Hash to verify authenticity.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // For user upsert, anon key is usually fine.
/** @type {SupabaseClient} */
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Handles POST requests for Telegram bot authentication.
 * Verifies the authenticity of data received from Telegram login widget/button.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object.
 */
export async function POST(req) {
  try {
    /** @type {TelegramAuthData} */
    const authData = await req.json();
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = authData;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN is not set.');
      return NextResponse.json({ error: 'Server configuration error: Bot token missing.' }, { status: 500 });
    }

    // Prepare data for hash verification, excluding 'hash' itself and ensuring correct order.
    // Filter out undefined values from the destructuring, as they shouldn't be part of the check string.
    /** @type {Object<string, string|number>} */
    const dataToCheck = {};
    if (auth_date !== undefined) dataToCheck.auth_date = auth_date;
    if (first_name !== undefined) dataToCheck.first_name = first_name;
    if (id !== undefined) dataToCheck.id = id;
    // last_name is optional and might not be part of hash calculation if not present
    if (last_name !== undefined) dataToCheck.last_name = last_name;
    if (photo_url !== undefined) dataToCheck.photo_url = photo_url;
    if (username !== undefined) dataToCheck.username = username;
    
    const checkString = Object.entries(dataToCheck)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort alphabetically by key
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secret = crypto.createHash('sha256').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (expectedHash !== hash) {
      console.warn('[TELEGRAM AUTH]: Hash mismatch.', { expectedHash, receivedHash: hash, checkString });
      return NextResponse.json({ error: 'Invalid data from Telegram: Hash verification failed.' }, { status: 400 });
    }

    // Upsert user into Supabase
    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        telegram_id: id,
        first_name: first_name || null, // Ensure null if undefined
        last_name: last_name || null,
        username: username || null,
        photo_url: photo_url || null,
        // Do not upsert auth_date or hash into the users table.
      }, {
        onConflict: 'telegram_id' // Specify the conflict target
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error during Telegram auth upsert:', error);
      return NextResponse.json({ error: 'Database error processing user information.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('[TELEGRAM AUTH API ERROR]:', /** @type {Error} */ (error));
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Server error during Telegram authentication.' }, { status: 500 });
  }
}
