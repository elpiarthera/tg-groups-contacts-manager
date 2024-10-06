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

export async function POST(req) {
  let client;
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
    if (!phoneNumber || typeof phoneNumber !== 'string' || !/^\+[1-9]\d{1,14}$/.test(phoneNumber.trim())) {
      return handleErrorResponse('Phone number is missing or invalid.', 400);
    }

    const validPhoneNumber = phoneNumber.trim();
    const parsedApiId = parseInt(apiId, 10);
    console.log('[DEBUG]: Valid phone number:', validPhoneNumber);
    console.log('[DEBUG]: Parsed API ID:', parsedApiId);

    checkRateLimit();

    // Check if user exists, if not create a new user
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', validPhoneNumber)
      .single();

    if (userError && userError.code === 'PGRST116') {
      // User not found, create a new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ 
          phone_number: validPhoneNumber,
          api_id: parsedApiId,
          api_hash: apiHash
        })
        .select()
        .single();

      if (createError) {
        console.error('[USER CREATE ERROR]:', createError);
        return handleErrorResponse('Failed to create user', 500);
      }
      user = newUser;
      console.log('[DEBUG]: New user created:', user);
    } else if (userError) {
      console.error('[USER FETCH ERROR]:', userError);
      return handleErrorResponse('Error fetching user data', 500);
    } else {
      console.log('[DEBUG]: Existing user found:', user);
    }

    const stringSession = new StringSession(user?.session_string || '');
    client = new TelegramClient(stringSession, parsedApiId, apiHash, {
      connectionRetries: 5,
      useWSS: true,
      timeout: 30000,
    });

    console.log('[DEBUG]: Connecting to Telegram...');
    await client.connect();
    console.log('[DEBUG]: Connected to Telegram');

    let isAuthorized = await client.isUserAuthorized();
    console.log('[DEBUG]: User authorized:', isAuthorized);

    if (!isAuthorized) {
      if (!validationCode) {
        console.log('[DEBUG]: Requesting phone code...');
        try {
          const result = await client.sendCode({
            apiId: parsedApiId,
            apiHash,
            phone: validPhoneNumber,
          });
          console.log('[DEBUG]: Phone code requested successfully');

          // Update user with phoneCodeHash and code_request_time
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              phoneCodeHash: result.phoneCodeHash,
              code_request_time: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) {
            console.error('[UPDATE ERROR]:', updateError);
            return handleErrorResponse('Failed to update user data', 500);
          }

          return NextResponse.json({ 
            success: true, 
            message: 'Validation code sent. Please check your Telegram app.',
            requiresValidation: true
          });
        } catch (error) {
          console.error('[ERROR]: Failed to send code:', error);
          return handleTelegramError(error);
        }
      } else {
        console.log('[DEBUG]: Proceeding with code validation');

        if (!user.phoneCodeHash || !user.code_request_time) {
          return handleErrorResponse('No validation code request found. Please request a new code.', 400);
        }

        const codeRequestTime = new Date(user.code_request_time);
        if (Date.now() - codeRequestTime.getTime() > 15 * 60 * 1000) { // 15 minutes expiration
          return handleErrorResponse('Validation code has expired. Please request a new one.', 400);
        }

        try {
          const signInResult = await client.invoke(
            new Api.auth.SignIn({
              phoneNumber: validPhoneNumber,
              phoneCodeHash: user.phoneCodeHash,
              phoneCode: validationCode
            })
          );

          if (!signInResult.user) {
            throw new Error('Failed to sign in');
          }

          console.log('[DEBUG]: Sign in successful');
          
          const sessionString = client.session.save();
          await supabase
            .from('users')
            .update({ 
              session_string: sessionString,
              phoneCodeHash: null,
              code_request_time: null
            })
            .eq('id', user.id);

          isAuthorized = true;
        } catch (error) {
          console.error('[ERROR]: Sign in failed:', error);
          return handleTelegramError(error);
        }
      }
    }

    if (isAuthorized) {
      console.log('[DEBUG]: Proceeding with data extraction');
      let extractedData = [];
      if (extractType === 'groups') {
        extractedData = await extractGroups(client);
      } else if (extractType === 'contacts') {
        extractedData = await extractContacts(client);
      }

      console.log('[DEBUG]: Data extraction completed');
      return NextResponse.json({ success: true, data: extractedData });
    } else {
      return handleErrorResponse('Failed to authorize with Telegram', 401);
    }

  } catch (error) {
    console.error('[ERROR]: An unexpected error occurred:', error);
    return handleErrorResponse('An unexpected error occurred', 500, error);
  } finally {
    if (client && client.connected) {
      try {
        await client.disconnect();
        console.log('[CLEANUP]: Telegram client disconnected successfully');
      } catch (disconnectError) {
        console.error('[ERROR]: Failed to disconnect client:', disconnectError);
      }
    }
  }
}

async function extractGroups(client) {
  const dialogs = await client.getDialogs();
  return dialogs.map(dialog => ({
    id: dialog.id.toString(),
    title: dialog.title,
    isChannel: dialog.isChannel
  }));
}

async function extractContacts(client) {
  const contacts = await client.getContacts();
  return contacts.map(contact => ({
    id: contact.id.toString(),
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone
  }));
}
