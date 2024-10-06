import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { checkRateLimit, handleTelegramError, handleErrorResponse } from '@/lib/apiUtils';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

let client;

export async function POST(req) {
  let extractedData = [];
  try {
    console.log('[START]: Handling API Request');
    const { apiId, apiHash, phoneNumber, extractType, validationCode } = await req.json();

    console.log('[DEBUG]: Received payload:', { 
      apiId, apiHash, phoneNumber, extractType, 
      validationCode: validationCode ? 'Provided' : 'Not provided',
    });

    // Input Validation
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
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

    checkRateLimit();

    const stringSession = new StringSession('');
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
      useWSS: true,
      timeout: 30000,
      retryDelay: 1000
    });

    console.log('[DEBUG]: Connecting to Telegram...');
    await client.connect();
    console.log('[DEBUG]: Connected to Telegram');

    // Store the session string for potential reuse
    const sessionString = client.session.save();
    console.log('[DEBUG]: Session string saved');

    // Fetch user data from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', validPhoneNumber)
      .single();

    if (userError) {
      console.error('[ERROR]: Error fetching user data:', userError);
      return handleErrorResponse('Error fetching user data', 500);
    }

    console.log('[DEBUG]: Retrieved user data:', userData);

    const { phoneCodeHash, code_request_time: codeRequestTime } = userData;

    if (!phoneCodeHash || !codeRequestTime) {
      return handleErrorResponse('Validation code not requested or expired. Please request a new code.', 400);
    }

    // Check if the code has expired
    const codeRequestDate = new Date(codeRequestTime);
    const currentTime = new Date();
    console.log('[DEBUG] Code request time:', codeRequestDate);
    console.log('[DEBUG] Current time:', currentTime);
    console.log('[DEBUG] Time difference (ms):', currentTime - codeRequestDate);

    const timeDifference = currentTime - codeRequestDate;
    if (timeDifference > 120000) { // 2 minutes
      return NextResponse.json({
        success: false,
        message: 'The verification code has expired. Please request a new code.',
        code: 'PHONE_CODE_EXPIRED'
      });
    }

    // Proceed with code validation
    console.log('[DEBUG]: Proceeding with code validation');
    if (!validationCode) {
      return handleErrorResponse('Validation code is missing', 400);
    }

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: validPhoneNumber,
          phoneCodeHash: phoneCodeHash,
          phoneCode: validationCode
        })
      );
      console.log('[DEBUG]: Sign in successful');
    } catch (error) {
      console.error('[ERROR]: Sign in failed:', error);
      return handleErrorResponse('Sign in failed', 400, error);
    }

    // Proceed with data extraction
    console.log('[DEBUG]: Proceeding with data extraction');
    if (extractType === 'groups') {
      extractedData = await extractGroups(client);
    } else if (extractType === 'contacts') {
      extractedData = await extractContacts(client);
    }

    console.log('[DEBUG]: Data extraction completed');
    return NextResponse.json({ success: true, data: extractedData });

  } catch (error) {
    console.error('[ERROR]: An unexpected error occurred:', error);
    return handleErrorResponse('An unexpected error occurred', 500, error);
  } finally {
    if (client && client.connected) {
      try {
        await client.disconnect();
        console.log('[CLEANUP]: Telegram client disconnected successfully');
      } catch (disconnectError) {
        console.error('[DISCONNECT ERROR]: Error disconnecting Telegram client:', disconnectError);
      }
    }
  }
}

async function extractGroups(client) {
  // Implementation for extracting groups
  console.log('[DEBUG]: Extracting groups');
  return []; // Placeholder
}

async function extractContacts(client) {
  // Implementation for extracting contacts
  console.log('[DEBUG]: Extracting contacts');
  return []; // Placeholder
}