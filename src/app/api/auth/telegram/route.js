import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase'; // Import shared Supabase client
import { handleErrorResponse } from '@/lib/apiUtils'; // For consistent error responses

/**
 * @typedef {import('next/server').NextRequest} NextRequest
 * @typedef {import('next/server').NextResponse} NextResponse
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

// Local Supabase client creation removed

/**
 * Handles POST requests for Telegram bot authentication.
 * Verifies the authenticity of data received from Telegram login widget/button.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object.
 */
export async function POST(req) {
  // Environment variable and Supabase client check
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!botToken || !supabaseUrl || !supabaseAnonKey || !supabase) {
    let missingVars = [];
    if (!botToken) missingVars.push('TELEGRAM_BOT_TOKEN');
    if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!supabase) missingVars.push('Supabase client initialization (check logs for supabase.js)');

    console.error('[SERVER CONFIG ERROR]: Missing required environment variables or Supabase client failed to init.', missingVars);
    return handleErrorResponse(`Server configuration error. Required variables: ${missingVars.join(', ')} are missing or client init failed.`, 500);
  }

  try {
    /** @type {TelegramAuthData} */
    const authData = await req.json();
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = authData;

    // Prepare data for hash verification
    /** @type {Object<string, string|number>} */
    const dataToCheck = {};
    if (auth_date !== undefined) dataToCheck.auth_date = auth_date;
    if (first_name !== undefined) dataToCheck.first_name = first_name;
    if (id !== undefined) dataToCheck.id = id;
    if (last_name !== undefined) dataToCheck.last_name = last_name;
    if (photo_url !== undefined) dataToCheck.photo_url = photo_url;
    if (username !== undefined) dataToCheck.username = username;

    const checkString = Object.entries(dataToCheck)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secret = crypto.createHash('sha256').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (expectedHash !== hash) {
      console.warn('[TELEGRAM AUTH]: Hash mismatch.', { expectedHash, receivedHash: hash, checkString });
      return handleErrorResponse('Invalid data from Telegram: Hash verification failed.', 400);
    }

    // Upsert user into Supabase using the shared client
    const { data: user, error: dbError } = await supabase
      .from('users')
      .upsert({
        telegram_id: id,
        first_name: first_name || null,
        last_name: last_name || null,
        username: username || null,
        photo_url: photo_url || null,
      }, {
        onConflict: 'telegram_id'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error during Telegram auth upsert:', dbError);
      // Use handleErrorResponse for consistency if it's imported and configured
      return handleErrorResponse('Database error processing user information.', 500, dbError);
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('[TELEGRAM AUTH API ERROR]:', /** @type {Error} */ (error));
    if (error instanceof SyntaxError) {
        return handleErrorResponse('Invalid JSON in request body.', 400, error);
    }
    return handleErrorResponse('Server error during Telegram authentication.', 500, error);
  }
}
