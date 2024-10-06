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
    if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber.trim())) {
      return handleErrorResponse('Phone number is missing or invalid.', 400);
    }

    const validPhoneNumber = phoneNumber.trim();
    console.log('[DEBUG]: Valid phone number:', validPhoneNumber);

    checkRateLimit();

    // Retrieve existing session from Supabase if available
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('session_string')
      .eq('phone_number', validPhoneNumber)
      .single();

    const stringSession = new StringSession(userData?.session_string || '');
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
      useWSS: true,
      timeout: 30000,
    });

    console.log('[DEBUG]: Connecting to Telegram...');
    await client.connect();
    console.log('[DEBUG]: Connected to Telegram');

    if (!client.isUserAuthorized()) {
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
          return handleTelegramError(error);
        }
      } else {
        // Validation code provided, proceed with sign in
        console.log('[DEBUG]: Proceeding with code validation');

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('phoneCodeHash')
          .eq('phone_number', validPhoneNumber)
          .single();

        if (userError) {
          console.error('[ERROR]: Error fetching user data:', userError);
          return handleErrorResponse('Error fetching user data', 500);
        }

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
          
          // Save the session string
          const sessionString = client.session.save();
          await supabase
            .from('users')
            .update({ session_string: sessionString })
            .eq('phone_number', validPhoneNumber);
        } catch (error) {
          console.error('[ERROR]: Sign in failed:', error);
          return handleTelegramError(error);
        }
      }
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
  } finally {
    if (client && client.connected) {
      await client.disconnect();
      console.log('[CLEANUP]: Telegram client disconnected successfully');
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