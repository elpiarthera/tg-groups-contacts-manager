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
  try {
    console.log('[START]: Handling API Request');
    const { apiId, apiHash, phoneNumber, extractType, validationCode } = await req.json();

    console.log('[DEBUG]: Received payload:', { 
      apiId, apiHash, phoneNumber, extractType, 
      validationCode: validationCode ? 'Provided' : 'Not provided',
    });

    // Input Validation
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      return handleErrorResponse('API ID is invalid or missing.', 400);
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      return handleErrorResponse('API Hash is invalid.', 400);
    }
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
      return handleErrorResponse('Phone number is missing or invalid.', 400);
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

    if (!validationCode) {
      console.log('[DEBUG]: Requesting phone code...');
      try {
        const result = await client.sendCode({
          apiId: parseInt(apiId),
          apiHash,
          phone: validPhoneNumber,
        });
        console.log('[DEBUG]: Phone code requested successfully');

        // Store the phone code hash in Supabase
        const { error } = await supabase
          .from('users')
          .upsert({ 
            phone_number: validPhoneNumber,
            phoneCodeHash: result.phoneCodeHash,
            code_request_time: new Date().toISOString()
          });

        if (error) {
          console.error('[ERROR]: Error storing phone code hash:', error);
          return handleErrorResponse('Error storing phone code hash', 500);
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Validation code sent. Please check your Telegram app.',
          requiresValidation: true
        });
      } catch (error) {
        console.error('[ERROR]: Failed to send code:', error);
        return handleErrorResponse('Failed to send validation code', 500, error);
      }
    }

    // Validation code provided, proceed with sign in
    console.log('[DEBUG]: Proceeding with code validation');

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

    const { phoneCodeHash } = userData;

    if (!phoneCodeHash) {
      return handleErrorResponse('Phone code hash not found. Please request a new code.', 400);
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
    let extractedData = [];
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
  }
}

async function extractGroups(client) {
  console.log('[DEBUG]: Extracting groups');
  return []; // Placeholder implementation
}

async function extractContacts(client) {
  console.log('[DEBUG]: Extracting contacts');
  return []; // Placeholder implementation
}