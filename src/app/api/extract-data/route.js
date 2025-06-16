import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { checkRateLimit, handleTelegramError, handleErrorResponse } from '@/lib/apiUtils';
import { createClient } from '@supabase/supabase-js';

/**
 * @typedef {import('next/server').NextRequest} NextRequest
 * @typedef {import('next/server').NextResponse} NextResponse
 * @typedef {import('telegram').TelegramClient} TelegramClient
 * @typedef {import('telegram/tl/types').User} TelegramUser
 * @typedef {import('telegram/tl/types').Dialog} TelegramDialog
 * @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient
 */

/**
 * @typedef {Object} UserDataFromDB
 * @property {string} id
 * @property {string | null} session_string
 * @property {string | null} phoneCodeHash
 * @property {string | null} code_request_time
 * @property {boolean | null} phone_registered
 */

/**
 * @typedef {Object} ExtractedGroup
 * @property {string} group_name
 * @property {string} group_id
 * @property {number} participant_count
 * @property {string} type - 'channel' or 'group'
 * @property {boolean} is_public
 * @property {string} owner_id
 * @property {string} creation_date
 * @property {string} description
 * @property {string} invite_link
 */

/**
 * @typedef {Object} ExtractedContact
 * @property {string} user_id
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} username
 * @property {string} phone_number
 * @property {string} owner_id
 * @property {string} extracted_at
 */


// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/** @type {SupabaseClient} */
const supabase = createClient(supabaseUrl, supabaseKey);

const CODE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Creates and connects a Telegram client.
 * @param {number|string} apiId - The user's Telegram API ID.
 * @param {string} apiHash - The user's Telegram API Hash.
 * @param {string} [session=''] - Optional existing session string.
 * @returns {Promise<TelegramClient>} A connected TelegramClient instance.
 * @throws {Error} If connection fails or times out.
 */
async function createTelegramClient(apiId, apiHash, session = '') {
  const stringSession = new StringSession(session);
  const client = new TelegramClient(stringSession, parseInt(String(apiId)), apiHash, { // Ensure apiId is string then parseInt
    connectionRetries: 3,
    useWSS: true,
    timeout: 15000, // Reduced timeout to 15 seconds
    dev: false,
  });
  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 20000))
    ]);
  } catch (error) {
    console.error('[CONNECTION ERROR]:', error);
    throw error;
  }
  return client;
}

/**
 * Handles POST requests for Telegram data extraction.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object.
 */
export async function POST(req) {
  /** @type {TelegramClient|undefined} */
  let client;
  try {
    console.log('[API /api/extract-data] POST request received');
    console.log('[START]: Handling API Request'); // Existing log, keeping it for now
    let body;
    try {
      body = await req.json();
      console.log('[API /api/extract-data] Request body:', body);
      if (body && body.action) {
        console.log('[API /api/extract-data] Action:', body.action);
      }
    } catch (error) {
      console.error('[API /api/extract-data] Error parsing request body:', error); // Enhanced log
      console.error('[ERROR]: Failed to parse request body', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { apiId, apiHash, phoneNumber, extractType, validationCode, action, twoFactorPassword } = body;

    const maskPhoneNumber = (pn) => {
      if (!pn || typeof pn !== 'string' || pn.length < 6) return pn; // or return '***';
      return `${pn.substring(0, 3)}****${pn.substring(pn.length - 2)}`;
    };

    console.log('[DEBUG]: Received payload:', { 
      apiId, // Assuming apiId is not as sensitive as a session token for logging purposes
      apiHash: apiHash ? 'Provided' : 'Not provided', // Mask actual apiHash value
      phoneNumber: phoneNumber ? maskPhoneNumber(phoneNumber) : 'Not provided',
      extractType,
      action,
      validationCode: validationCode ? 'Provided' : 'Not provided',
      twoFactorPassword: twoFactorPassword ? 'Provided' : 'Not provided',
    });

    if (action === 'checkSession') {
      const { data: sessionUserData, error: sessionError } = await supabase
        .from('users')
        .select('session_string')
        .eq('phone_number', phoneNumber)
        .single();
      if (sessionError && sessionError.code !== 'PGRST116') { // PGRST116: row not found, not an error for checkSession
        console.error('[API /api/extract-data] Supabase error during checkSession select:', sessionError);
        console.error('[SESSION CHECK SUPABASE ERROR]:', sessionError);
        return handleErrorResponse('Error checking session.', 500, sessionError);
      }
      if (sessionUserData?.session_string) {
        return NextResponse.json({ hasSession: true });
      } else {
        return NextResponse.json({ hasSession: false });
      }
    }

    if (!apiId || isNaN(parseInt(String(apiId))) || parseInt(String(apiId)) <= 0) {
      return handleErrorResponse('API ID is invalid or missing. Please provide a valid positive number.', 400);
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      return handleErrorResponse('API Hash is invalid. It should be a 32-character hexadecimal string.', 400);
    }
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
      return handleErrorResponse('Phone number is missing or invalid. Please enter a valid phone number.', 400);
    }

    const validPhoneNumber = phoneNumber.trim();
    console.log('[DEBUG]: Valid phone number:', validPhoneNumber);

    // TODO: Implement proper IP address retrieval for rate limiting.
    // In a Vercel environment (especially with Edge Functions / NextRequest):
    // - User's IP: `req.ip` (Vercel automatically provides this)
    // - Alternatively, check `req.headers.get('x-forwarded-for')`. This might contain a list of IPs;
    //   the first one is often the client's IP. e.g., `(req.headers.get('x-forwarded-for') || '').split(',')[0].trim()`
    // - For Node.js runtime (less common for new Next.js API routes): `req.socket.remoteAddress`
    //   (but headers like 'x-forwarded-for' are more reliable behind proxies).
    // Choose the most reliable method for your deployment environment.
    await checkRateLimit(req.ip || req.headers.get('x-forwarded-for') || "user_ip_placeholder");

    /** @type {{data: UserDataFromDB | null, error: any}} */
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('id, session_string, phoneCodeHash, code_request_time, phone_registered')
      .eq('phone_number', validPhoneNumber)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[API /api/extract-data] Supabase error fetching user details:', fetchError);
      console.error('[FETCH ERROR]:', fetchError);
      return handleErrorResponse('Error retrieving user data. Please try again.', 500);
    }

    client = await createTelegramClient(apiId, apiHash, userData?.session_string || '');

    if (!client || !client.connected) {
      return NextResponse.json({ 
          error: 'Failed to connect to Telegram servers. Please check your API ID/Hash and network.',
          details: 'Client connection failed or client is null.'
      }, { status: 503 });
    }

    if (userData?.session_string && extractType) {
      return await handleDataExtraction(client, validPhoneNumber, extractType, userData.id);
    }

    if (!validationCode && !twoFactorPassword) {
      return await handleCodeRequest(client, apiId, apiHash, validPhoneNumber);
    }

    return await handleSignInOrSignUp(client, validPhoneNumber, userData, validationCode, extractType, twoFactorPassword);

  } catch (error) {
    console.error('[MAIN POST HANDLER ERROR]: Error in extract-data API:', /** @type {Error} */ (error));
    if (error.message && (
        error.message.includes('SESSION_PASSWORD_NEEDED') ||
        (/** @type {any} */ (error).errorMessage === 'SESSION_PASSWORD_NEEDED') ||
        error.message.includes('PHONE_NUMBER_INVALID') ||
        error.message.includes('PHONE_CODE_INVALID') ||
        error.message.includes('PHONE_CODE_EXPIRED') ||
        error.message.includes('AUTH_KEY_UNREGISTERED')
        )) {
        return handleTelegramError(error);
    }
    if (error.message && error.message.includes('Connection timeout')) {
        return NextResponse.json({
            error: 'Failed to connect to Telegram servers (Timeout). Please try again later.',
            details: error.message
        }, { status: 503 });
    }
    return handleErrorResponse(
        error.message || 'An unexpected error occurred. Please try again later.',
        /** @type {any} */ (error).status || 500,
        error
    );
  } finally {
    if (client && client.connected) {
      console.log('[FINALLY]: Disconnecting Telegram client');
      try {
        await client.disconnect();
        console.log('[SUCCESS]: Client disconnected');
      } catch (disconnectError) {
        console.error('[DISCONNECT ERROR]:', disconnectError);
      }
    }
  }
}

/**
 * Handles the request for a validation code from Telegram.
 * @param {TelegramClient} passedClient - The initialized Telegram client.
 * @param {number|string} apiId - User's API ID.
 * @param {string} apiHash - User's API Hash.
 * @param {string} phoneNumber - User's phone number.
 * @returns {Promise<NextResponse>}
 */
async function handleCodeRequest(passedClient, apiId, apiHash, phoneNumber) {
  console.log('[PROCESS]: Requesting validation code');
  try {
    const result = await passedClient.sendCode(
      { apiId: parseInt(String(apiId)), apiHash: apiHash },
      phoneNumber
    );
    console.log('[SUCCESS]: Validation code requested successfully');
    
    const userDataToUpsert = {
      phone_number: phoneNumber,
      phoneCodeHash: result.phoneCodeHash,
      code_request_time: new Date().toISOString(),
      phone_registered: result.phone_registered !== false
    };

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(userDataToUpsert)
      .eq('phone_number', phoneNumber);

    if (upsertError) {
      console.error('[UPSERT ERROR during code request]:', upsertError);
      throw upsertError;
    }

    console.log('[DEBUG]: Updated user with phoneCodeHash and code_request_time');
    return NextResponse.json({
      success: true,
      message: 'Validation code sent to your Telegram app. Please provide it in the next step.',
      requiresValidation: true,
      phoneRegistered: result.phone_registered !== false
    });
  } catch (error) {
    console.error('[SEND CODE ERROR]:', error);
    throw error;
  }
}

/**
 * Handles user sign-in or sign-up with Telegram.
 * @param {TelegramClient} passedClient - The initialized Telegram client.
 * @param {string} phoneNumber - User's phone number.
 * @param {UserDataFromDB | null} userData - User data from Supabase.
 * @param {string} [validationCode] - The validation code entered by the user.
 * @param {'groups' | 'contacts' | undefined} [extractType] - The type of data to extract after login.
 * @param {string} [twoFactorPassword] - The 2FA password, if required.
 * @returns {Promise<NextResponse>}
 */
async function handleSignInOrSignUp(passedClient, phoneNumber, userData, validationCode, extractType, twoFactorPassword) {
  console.log('[PROCESS]: Attempting to sign in/up with' +
              (validationCode ? ` code ${validationCode}` : '') +
              (twoFactorPassword ? ' and 2FA password.' : '.'));
  try {
    const { phoneCodeHash, code_request_time: codeRequestTime, phone_registered: phoneRegistered } = userData || {};

    if (!phoneCodeHash && !passedClient.session.isSaved()) {
        return handleErrorResponse('Verification code process not initiated or user data missing. Please request a code first.', 400);
    }

    if (validationCode && codeRequestTime) {
        const codeRequestDate = new Date(codeRequestTime).getTime();
        const currentTime = Date.now();
        if ((currentTime - codeRequestDate) > CODE_EXPIRATION_TIME) {
            return NextResponse.json({
                success: false,
                message: 'The verification code has expired. Please request a new code.',
                code: 'PHONE_CODE_EXPIRED'
            });
        }
    }

    /** @type {any} */
    const signInParams = {
      phoneNumber: phoneNumber,
      phoneCodeHash: phoneCodeHash,
      phoneCode: validationCode,
      ...(twoFactorPassword && { password: twoFactorPassword }),
    };

    if (phoneRegistered) {
      await passedClient.signIn(signInParams);
    } else {
      if (twoFactorPassword) {
        console.warn('[WARN]: 2FA password provided during a phase identified as sign-up.');
        await passedClient.signIn(signInParams);
      } else {
        await passedClient.invoke(new Api.auth.SignUp({
            phoneNumber: phoneNumber,
            phoneCodeHash: phoneCodeHash,
            phoneCode: validationCode,
            firstName: 'New',
            lastName: 'User'
        }));
      }
    }

    console.log('[SUCCESS]: Signed in/up successfully');

    const sessionString = passedClient.session.save();
    await supabase
      .from('users')
      .update({
        session_string: sessionString,
        phone_registered: true,
        phoneCodeHash: null,
        code_request_time: null
      })
      .eq('phone_number', phoneNumber);

    if (extractType && userData) { // Ensure userData and thus userData.id is available
      return await handleDataExtraction(passedClient, phoneNumber, extractType, userData.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication successful. Session saved.',
    });

  } catch (error) {
    console.error('[API /api/extract-data] Telegram client connection error:', error);
    console.error('[API /api/extract-data] Error in handleCodeRequest:', error);
    console.error('[API /api/extract-data] Error in handleSignInOrSignUp:', error);
    console.error('[SIGN IN/UP ERROR SPECIFIC]:', error);
    throw error;
  }
}

/**
 * Extracts data (groups or contacts) from Telegram.
 * @param {TelegramClient} passedClient - The initialized Telegram client.
 * @param {string} phoneNumber - User's phone number.
 * @param {'groups' | 'contacts'} extractType - The type of data to extract.
 * @param {string} userId - The user's ID from Supabase (owner_id for the extracted data).
 * @returns {Promise<NextResponse>}
 */
async function handleDataExtraction(passedClient, phoneNumber, extractType, userId) {
  /** @type {(ExtractedGroup[] | ExtractedContact[])} */
  let extractedData = [];
  const MAX_DIALOGS_TO_FETCH = 500;

  try {
    // userId is already the ownerUserId from the users table passed from POST handler
    const ownerUserId = userId;

    if (extractType === 'groups') {
      console.log('[DEBUG]: Starting group extraction using iterDialogs.');
      let count = 0;
      for await (const dialog of passedClient.iterDialogs({})) {
        if (count >= MAX_DIALOGS_TO_FETCH) {
          console.warn(`[WARN]: Reached safeguard limit of ${MAX_DIALOGS_TO_FETCH} dialogs.`);
          break;
        }
        if (dialog.isUser) {
            continue;
        }
        /** @type {ExtractedGroup} */
        const groupEntry = {
          group_name: dialog.title || 'Unknown Title',
          group_id: dialog.id?.toString() || 'Unknown ID',
          participant_count: dialog.entity?.participantsCount || 0,
          type: dialog.isChannel ? 'channel' : 'group',
          is_public: !!dialog.entity?.username,
          owner_id: ownerUserId,
          creation_date: dialog.date instanceof Date ? dialog.date.toISOString() : (typeof dialog.date === 'number' ? new Date(dialog.date * 1000).toISOString() : new Date().toISOString()),
          description: dialog.message?.message || '',
          invite_link: '',
        };
        extractedData.push(groupEntry);
        count++;
      }
      console.log(`[DEBUG]: Fetched ${count} dialogs (groups/channels).`);
    } else if (extractType === 'contacts') {
      console.log('[DEBUG]: Starting contact extraction.');
      const result = await passedClient.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) })); // hash should be BigInt
      if (Array.isArray(result.users)) {
        extractedData = result.users.map(/** @param {TelegramUser} user */ user => ({
            user_id: user.id.toString(),
            first_name: user.firstName || '',
            last_name: user.lastName || '',
            username: user.username || '',
            phone_number: user.phone || '',
            owner_id: ownerUserId,
            extracted_at: new Date().toISOString(),
        }));
      }
    } else {
      // Should not happen if extractType is validated before calling
      return handleErrorResponse('Invalid extract type specified.', 400);
    }

    console.log(`[DEBUG]: Extracted ${extractedData.length} ${extractType}.`);
    if (extractedData.length > 0) {
        const { error: insertError } = await supabase.from(extractType).insert(extractedData);
        if (insertError) {
            console.error(`[INSERT ERROR for ${extractType}]:`, insertError);
            throw insertError;
        }
    } else {
        console.log(`[DEBUG]: No ${extractType} to insert.`);
    }

    return NextResponse.json({
      success: true,
      message: `${extractType} extracted successfully. Found ${extractedData.length} items.`,
      data: extractedData,
    });
  } catch (error) {
    console.error(`[API /api/extract-data] Error in handleDataExtraction for ${extractType}:`, error);
    console.error(`[DATA EXTRACTION ERROR for ${extractType}]:`, /** @type {Error} */ (error));
    throw new Error(`Failed to extract ${extractType}: ${error.message}`, { cause: error });
  }
}

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
