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
    });

    console.log('[PROCESS]: Connecting to Telegram');
    await client.connect();

    if (!client.connected) {
      throw new Error('Failed to connect to Telegram');
    }

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

      if (createError) throw createError;
      user = newUser;
    } else if (userError) {
      throw userError;
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
        
        // Store phoneCodeHash in Supabase
        const { error: updateError } = await supabase
          .from('users')
          .update({ phone_code_hash: result.phoneCodeHash, code_request_time: new Date().toISOString() })
          .eq('id', user.id);

        if (updateError) throw updateError;

        return NextResponse.json({
          success: true,
          message: 'Validation code sent to your phone. Please provide it in the next step.',
          requiresValidation: true,
        });
      } catch (error) {
        console.error('[SEND CODE ERROR]:', error);
        return handleTelegramError(error);
      }
    }

    // Retrieve phoneCodeHash from Supabase
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('phone_code_hash, code_request_time')
      .eq('id', user.id)
      .single();

    if (fetchError) throw fetchError;

    const { phone_code_hash: phoneCodeHash, code_request_time: codeRequestTime } = userData;

    // Check if the code has expired
    const codeRequestDate = new Date(codeRequestTime);
    const currentTime = new Date();
    const timeDifference = currentTime - codeRequestDate;
    if (timeDifference > 120000) { // 2 minutes
      return NextResponse.json({
        success: false,
        message: 'The verification code has expired. Please request a new code.',
        code: 'PHONE_CODE_EXPIRED'
      });
    }

    // Step 2: Sign in with the provided validation code and extract data
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
      }

      // Insert extracted data into Supabase
      const { error: insertError } = await supabase
        .from(extractType)
        .insert(extractedData);

      if (insertError) throw insertError;

      // Clear the phoneCodeHash after successful sign-in
      await supabase
        .from('users')
        .update({ phone_code_hash: null, code_request_time: null })
        .eq('id', user.id);

      return NextResponse.json({
        success: true,
        message: `${extractType} extracted successfully`,
        sessionString: client.session.save(),
      });
    } catch (error) {
      console.error('[SIGN IN ERROR]:', error);
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
