import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleErrorResponse } from '@/lib/apiUtils';

/**
 * @typedef {import('next/server').NextRequest} NextRequest
 * @typedef {import('next/server').NextResponse} NextResponse
 * @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient
 */

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/** @type {SupabaseClient} */
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Handles POST requests for user logout.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { phoneNumber } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') { // Added type check for phoneNumber
      return handleErrorResponse('Phone number is required and must be a string for logout.', 400);
    }

    console.log(`[LOGOUT ATTEMPT]: Phone number: ${phoneNumber}`);

    const { data, error } = await supabase
      .from('users')
      .update({
        session_string: null,
        phoneCodeHash: null,
        code_request_time: null
      })
      .eq('phone_number', phoneNumber)
      .select();

    if (error) {
      console.error('[LOGOUT SUPABASE ERROR]:', error);
      return handleErrorResponse('Supabase error during logout.', 500, error);
    }

    if (!data || data.length === 0) {
      console.log(`[LOGOUT INFO]: No user found with phone number ${phoneNumber} to logout or already logged out.`);
    }

    console.log(`[LOGOUT SUCCESS]: Cleared session for phone number: ${phoneNumber}`);
    return NextResponse.json({ success: true, message: 'Logged out successfully.' });

  } catch (error) {
    console.error('[LOGOUT API ERROR]:', /** @type {Error} */ (error));
    if (error instanceof SyntaxError) {
        return handleErrorResponse('Invalid JSON in request body.', 400, error);
    }
    return handleErrorResponse('An unexpected error occurred during logout.', 500, error);
  }
}
