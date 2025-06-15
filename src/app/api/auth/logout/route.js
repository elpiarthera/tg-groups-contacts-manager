import { NextResponse } from 'next/server';
// Import the shared Supabase client instance
import { supabase } from '@/lib/supabase';
import { handleErrorResponse } from '@/lib/apiUtils';

/**
 * @typedef {import('next/server').NextRequest} NextRequest
 * @typedef {import('next/server').NextResponse} NextResponse
 */

/**
 * Handles POST requests for user logout.
 * This endpoint now expects a JWT in the Authorization header for authentication.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object.
 */
export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.split('Bearer ')[1];

    if (!jwt) {
      return handleErrorResponse('No JWT provided. Unauthorized.', 401);
    }

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError) {
      console.error('[LOGOUT AUTH ERROR]:', authError);
      return handleErrorResponse('Authentication failed. Invalid JWT.', 401, authError);
    }
    if (!user) {
      console.warn('[LOGOUT AUTH WARN]: No user found for the provided JWT.');
      return handleErrorResponse('Authentication failed. No user found for token.', 403);
    }

    console.log(`[LOGOUT ATTEMPT]: Authenticated user ID: ${user.id}`);

    // Update the user's record to clear session-related fields using their authenticated ID
    const { error: updateError } = await supabase
      .from('users')
      .update({
        session_string: null,
        phoneCodeHash: null,
        code_request_time: null
      })
      .eq('id', user.id); // Use the authenticated user's ID from the JWT

    if (updateError) {
      console.error('[LOGOUT SUPABASE UPDATE ERROR]:', updateError);
      return handleErrorResponse('Supabase error during logout process.', 500, updateError);
    }

    // Note: We don't use .select() anymore, so we don't check `data.length`.
    // The operation is successful if updateError is null.
    // It's fine if the user record was already "logged out" (null session_string).

    console.log(`[LOGOUT SUCCESS]: Cleared session for user ID: ${user.id}`);
    return NextResponse.json({ success: true, message: 'Logged out successfully.' });

  } catch (error) {
    console.error('[LOGOUT API UNEXPECTED ERROR]:', /** @type {Error} */ (error));
    // req.json() is not called anymore, so SyntaxError for body parsing is less likely unless other JSON is processed.
    // However, keeping a general catch-all is good.
    return handleErrorResponse('An unexpected error occurred during logout.', 500, error);
  }
}
