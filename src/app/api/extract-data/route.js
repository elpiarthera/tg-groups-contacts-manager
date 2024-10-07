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

const CODE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

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

    // Initialize TelegramClient
    const stringSession = new StringSession('');
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
      useWSS: true,
      timeout: 30000,
      dev: false, // Ensure we're using the production DC
    });

    console.log('[PROCESS]: Connecting to Telegram');
    await client.connect();

    if (!client.connected) {
      throw new Error('Failed to connect to Telegram');
    }

    // Step 1: Request validation code if not provided
    if (!validationCode) {
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
        
        // Check if user already exists
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('phone_number', validPhoneNumber)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('[FETCH ERROR]:', fetchError);
          throw fetchError;
        }

        const userData = {
          phone_number: validPhoneNumber,
          api_id: parseInt(apiId),
          api_hash: apiHash,
          phoneCodeHash: result.phoneCodeHash,
          code_request_time: new Date().toISOString(),
          phone_registered: result.phone_registered !== false
        };

        let upsertResult;
        if (existingUser) {
          // Update existing user
          const { data, error } = await supabase
            .from('users')
            .update(userData)
            .eq('phone_number', validPhoneNumber)
            .select()
            .single();
          upsertResult = { data, error };
        } else {
          // Insert new user
          const { data, error } = await supabase
            .from('users')
            .insert(userData)
            .select()
            .single();
          upsertResult = { data, error };
        }

        if (upsertResult.error) {
          console.error('[UPSERT ERROR]:', upsertResult.error);
          throw upsertResult.error;
        }

        console.log('[DEBUG]: Updated user with phoneCodeHash and code_request_time');

        return NextResponse.json({
          success: true,
          message: 'Validation code sent to your phone. Please provide it in the next step.',
          requiresValidation: true,
          phoneRegistered: result.phone_registered !== false
        });
      } catch (error) {
        console.error('[SEND CODE ERROR]:', error);
        if (error.code === '23505') {
          return handleErrorResponse('This phone number is already registered. Please use a different number or try again later.', 409);
        }
        return handleTelegramError(error);
      }
    }

    // Retrieve user data from Supabase
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('phoneCodeHash, code_request_time, phone_registered')
      .eq('phone_number', validPhoneNumber)
      .single();

    if (fetchError) {
      console.error('[FETCH ERROR]:', fetchError);
      return handleErrorResponse('User not found. Please request a new code.', 404);
    }

    console.log('[DEBUG]: Retrieved user data:', userData);

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

    // Step 2: Sign in or Sign up with the provided validation code
    console.log('[PROCESS]: Attempting to sign in/up with provided code');
    try {
      let signInResult;
      if (phoneRegistered) {
        signInResult = await client.invoke(new Api.auth.SignIn({
          phoneNumber: validPhoneNumber,
          phoneCodeHash: phoneCodeHash,
          phoneCode: validationCode
        }));
      } else {
        // If phone is not registered, use SignUp instead
        signInResult = await client.invoke(new Api.auth.SignUp({
          phoneNumber: validPhoneNumber,
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
        .update({ session_string: sessionString, phone_registered: true })
        .eq('phone_number', validPhoneNumber);

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
          owner_id: validPhoneNumber,
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
          owner_id: validPhoneNumber,
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

      // Clear the phoneCodeHash after successful sign-in
      const { error: clearError } = await supabase
        .from('users')
        .update({ phoneCodeHash: null, code_request_time: null })
        .eq('phone_number', validPhoneNumber);

      if (clearError) {
        console.error('[CLEAR HASH ERROR]:', clearError);
        // Not throwing here as it's not critical
      }

      return NextResponse.json({
        success: true,
        message: `${extractType} extracted successfully`,
        data: extractedData,
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
  } catch (error) {
    console.error('[GENERAL API ERROR]: Error in extract-data API:', error);
    return handleErrorResponse('An unexpected error occurred. Please try again later.', 500, error);
  } finally {
    if (client) {
      await client.disconnect();
    }
  }
}
