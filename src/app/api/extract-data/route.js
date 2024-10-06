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
    const { apiId, apiHash, phoneNumber, extractType, validationCode, action } = await req.json();

    console.log('[DEBUG]: Received payload:', { 
      apiId, apiHash, phoneNumber, extractType, action,
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

    // Check if user exists, if not create a new user in Supabase
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', validPhoneNumber)
      .single();

    if (userError && userError.code === 'PGRST116') {
      // User not found, create a new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ phone_number: validPhoneNumber, api_id: apiId, api_hash: apiHash })
        .select()
        .single();

      if (createError) {
        console.error('[USER CREATE ERROR]:', createError);
        throw createError;
      }
      user = newUser;
      console.log('[DEBUG]: New user created:', user.id);
    } else if (userError) {
      console.error('[USER FETCH ERROR]:', userError);
      throw userError;
    }

    if (action === 'authenticate') {
      // Check if a valid session exists
      if (user.session_string) {
        try {
          const stringSession = new StringSession(user.session_string);
          client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
            connectionRetries: 5,
            useWSS: true,
            timeout: 30000,
          });

          await client.connect();
          console.log('[SUCCESS]: Reused existing session');
          return NextResponse.json({
            success: true,
            message: 'Authentication successful using existing session',
          });
        } catch (error) {
          console.error('[SESSION REUSE ERROR]:', error);
          // If session is invalid, clear it and proceed with new authentication
          await supabase
            .from('users')
            .update({ session_string: null })
            .eq('id', user.id);
        }
      }

      // Proceed with new authentication if no valid session exists
      const stringSession = new StringSession('');
      client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
        connectionRetries: 5,
        useWSS: true,
        timeout: 30000,
      });

      console.log('[PROCESS]: Connecting to Telegram');
      await client.connect();

      if (!client.connected) {
        throw new Error('Failed to connect to Telegram');
      }

      console.log('[PROCESS]: Requesting validation code');
      try {
        const result = await client.sendCode(
          {
            apiId: parseInt(apiId),
            apiHash: apiHash,
          },
          validPhoneNumber
        );
        console.log('[SUCCESS]: Validation code requested successfully');
        
        // Store phoneCodeHash in Supabase
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            phoneCodeHash: result.phoneCodeHash, 
            code_request_time: new Date().toISOString() 
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('[UPDATE ERROR]:', updateError);
          throw updateError;
        }

        console.log('[DEBUG]: Updated user with phoneCodeHash and code_request_time');

        return NextResponse.json({
          success: true,
          message: 'Validation code sent to your phone. Please provide it in the next step.',
          requiresValidation: true,
        });
      } catch (error) {
        console.error('[SEND CODE ERROR]:', error);
        return handleTelegramError(error);
      }
    } else if (action === 'verify') {
      // Retrieve phoneCodeHash from Supabase
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('phoneCodeHash, code_request_time')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        console.error('[FETCH ERROR]:', fetchError);
        throw fetchError;
      }

      console.log('[DEBUG]: Retrieved user data:', userData);

      const { phoneCodeHash, code_request_time: codeRequestTime } = userData;

      if (!phoneCodeHash || !codeRequestTime) {
        return handleErrorResponse('Validation code not requested or expired. Please request a new code.', 400);
      }

      const stringSession = new StringSession('');
      client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
        connectionRetries: 5,
        useWSS: true,
        timeout: 30000,
      });

      await client.connect();

      console.log('[PROCESS]: Attempting to sign in with provided code');
      try {
        const signInResult = await client.invoke(new Api.auth.SignIn({
          phoneNumber: validPhoneNumber,
          phoneCodeHash: phoneCodeHash,
          phoneCode: validationCode
        }));

        if (!signInResult.user) {
          throw new Error('Failed to sign in. Please check your validation code and try again.');
        }

        console.log('[SUCCESS]: Signed in successfully');

        // Save the session string
        const sessionString = client.session.save();
        await supabase
          .from('users')
          .update({ session_string: sessionString })
          .eq('id', user.id);

        return NextResponse.json({
          success: true,
          message: 'Authentication successful',
        });
      } catch (error) {
        console.error('[SIGN IN ERROR]:', error);
        return handleTelegramError(error);
      }
    } else if (action === 'extract') {
      // Retrieve session string from Supabase
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('session_string')
        .eq('id', user.id)
        .single();

      if (fetchError || !userData.session_string) {
        return handleErrorResponse('No valid session found. Please authenticate first.', 400);
      }

      const stringSession = new StringSession(userData.session_string);
      client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
        connectionRetries: 5,
        useWSS: true,
        timeout: 30000,
      });

      try {
        await client.connect();
      } catch (error) {
        if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
          // Session expired, clear it and ask for re-authentication
          await supabase
            .from('users')
            .update({ session_string: null })
            .eq('id', user.id);
          return handleErrorResponse('Session expired. Please authenticate again.', 401);
        }
        throw error;
      }

      // Perform data extraction based on extractType
      let extractedData = [];
      if (extractType === 'groups') {
        const dialogs = await client.getDialogs();
        extractedData = dialogs.map(dialog => ({
          group_name: dialog.title,
          group_id: dialog.id.toString(),
          participant_count: dialog.participantsCount || 0,
          type: dialog.isChannel ? 'channel' : 'group',
          is_public: !!dialog.username,
          owner_id: user.id,
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
          owner_id: user.id,
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

    return handleErrorResponse('Invalid action specified', 400);
  } catch (error) {
    console.error('[GENERAL API ERROR]: Error in extract-data API:', error);
    return handleErrorResponse('An unexpected error occurred. Please try again later.', 500, error);
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