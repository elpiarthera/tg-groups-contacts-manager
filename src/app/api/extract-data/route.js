import { NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { checkRateLimit, handleTelegramError, handleErrorResponse } from '@/lib/apiUtils';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: '8mb',
  },
  maxDuration: 60,
};

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const CODE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

// Persistent TelegramClient instance
let persistentClient;

async function getPersistentClient(apiId, apiHash, session = '') {
  if (!persistentClient) {
    const stringSession = new StringSession(session);
    persistentClient = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
      useWSS: true,
      timeout: 30000,
      dev: false, // Ensure we're using the production DC
    });
    await persistentClient.connect();
  }
  return persistentClient;
}

export async function POST(req) {
  try {
    console.log('[START]: Handling API Request');
    const { apiId, apiHash, phoneNumber, extractType, validationCode, action } = await req.json();

    console.log('[DEBUG]: Received payload:', { 
      apiId, apiHash, phoneNumber, extractType, action,
      validationCode: validationCode ? 'Provided' : 'Not provided',
    });

    // Check for existing session
    if (action === 'checkSession') {
      const { data: userData, error } = await supabase
        .from('users')
        .select('session_string')
        .eq('phone_number', phoneNumber)
        .single();

      if (userData?.session_string) {
        return NextResponse.json({ hasSession: true });
      } else {
        return NextResponse.json({ hasSession: false });
      }
    }

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

    // Retrieve user data from Supabase
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('session_string, phoneCodeHash, code_request_time, phone_registered')
      .eq('phone_number', validPhoneNumber)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[FETCH ERROR]:', fetchError);
      return handleErrorResponse('Error retrieving user data. Please try again.', 500);
    }

    // Get or initialize the persistent TelegramClient
    const client = await getPersistentClient(apiId, apiHash, userData?.session_string || '');

    if (!client.connected) {
      throw new Error('Failed to connect to Telegram');
    }

    // If we have a session and an extract type, proceed with extraction
    if (userData?.session_string && extractType) {
      return await handleDataExtraction(client, validPhoneNumber, extractType);
    }

    // Step 1: Request validation code if not provided
    if (!validationCode) {
      return await handleCodeRequest(client, apiId, apiHash, validPhoneNumber);
    }

    // Step 2: Sign in or Sign up with the provided validation code
    return await handleSignInOrSignUp(client, validPhoneNumber, userData, validationCode, extractType);

  } catch (error) {
    console.error('[GENERAL API ERROR]: Error in extract-data API:', error);
    return handleErrorResponse('An unexpected error occurred. Please try again later.', 500, error);
  }
}

async function handleCodeRequest(client, apiId, apiHash, phoneNumber) {
  console.log('[PROCESS]: Requesting validation code');
  try {
    const result = await client.sendCode(
      {
        apiId: parseInt(apiId),
        apiHash: apiHash,
      },
      phoneNumber
    );
    console.log('[SUCCESS]: Validation code requested successfully');
    
    const userData = {
      phone_number: phoneNumber,
      api_id: parseInt(apiId),
      api_hash: apiHash,
      phoneCodeHash: result.phoneCodeHash,
      code_request_time: new Date().toISOString(),
      phone_registered: result.phone_registered !== false
    };

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(userData)
      .eq('phone_number', phoneNumber);

    if (upsertError) {
      console.error('[UPSERT ERROR]:', upsertError);
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
    return handleTelegramError(error);
  }
}

async function handleSignInOrSignUp(client, phoneNumber, userData, validationCode, extractType) {
  console.log('[PROCESS]: Attempting to sign in/up with provided code');
  try {
    const { phoneCodeHash, code_request_time: codeRequestTime, phone_registered: phoneRegistered } = userData;

    if (!phoneCodeHash || !codeRequestTime) {
      return handleErrorResponse('Validation code not requested or expired. Please request a new code.', 400);
    }

    // Check if the code has expired
    const codeRequestDate = new Date(codeRequestTime).getTime();
    const currentTime = Date.now();
    if ((currentTime - codeRequestDate) > CODE_EXPIRATION_TIME) {
      return NextResponse.json({
        success: false,
        message: 'The verification code has expired. Please request a new code.',
        code: 'PHONE_CODE_EXPIRED'
      });
    }

    let signInResult;
    if (phoneRegistered) {
      signInResult = await client.invoke(new Api.auth.SignIn({
        phoneNumber: phoneNumber,
        phoneCodeHash: phoneCodeHash,
        phoneCode: validationCode
      }));
    } else {
      signInResult = await client.invoke(new Api.auth.SignUp({
        phoneNumber: phoneNumber,
        phoneCodeHash: phoneCodeHash,
        phoneCode: validationCode,
        firstName: 'New',
        lastName: 'User'
      }));
    }

    if (!signInResult.user) {
      throw new Error('Failed to sign in/up. Please check your validation code and try again.');
    }

    console.log('[SUCCESS]: Signed in/up successfully');

    // Save the session string
    const sessionString = client.session.save();
    await supabase
      .from('users')
      .update({ session_string: sessionString, phone_registered: true, phoneCodeHash: null, code_request_time: null })
      .eq('phone_number', phoneNumber);

    if (extractType) {
      return await handleDataExtraction(client, phoneNumber, extractType);
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
    });

  } catch (error) {
    console.error('[SIGN IN/UP ERROR]:', error);
    if (error.errorMessage === 'PHONE_CODE_EXPIRED') {
      return NextResponse.json({
        success: false,
        message: 'The verification code has expired. Please request a new code.',
        code: 'PHONE_CODE_EXPIRED'
      });
    }
    return handleTelegramError(error);
  }
}

async function handleDataExtraction(client, phoneNumber, extractType) {
  let extractedData = [];
  if (extractType === 'groups') {
    const dialogs = await client.getDialogs();
    extractedData = dialogs.map(dialog => ({
      group_name: dialog.title,
      group_id: dialog.id.toString(),
      participant_count: dialog.participantsCount || 0,
      type: dialog.isChannel ? 'channel' : 'group',
      is_public: !!dialog.username,
      owner_id: phoneNumber,
    }));
  } else if (extractType === 'contacts') {
    const contacts = await client.getContacts();
    extractedData = contacts.map(contact => ({
      user_id: contact.id.toString(),
      first_name: contact.firstName,
      last_name: contact.lastName,
      username: contact.username,
      phone_number: contact.phone,
      is_mutual_contact: contact.mutualContact,
      owner_id: phoneNumber,
    }));
  } else {
    throw new Error('Invalid extract type specified');
  }

  console.log(`[DEBUG]: Extracted ${extractedData.length} ${extractType}`);

  // Insert extracted data into Supabase
  const { error: insertError } = await supabase
    .from(extractType)
    .insert(extractedData);

  if (insertError) {
    console.error('[INSERT ERROR]:', insertError);
    throw insertError;
  }

  return NextResponse.json({
    success: true,
    message: `${extractType} extracted successfully`,
    data: extractedData,
  });
}
