Directory Structure:

└── ./
    ├── .vercel
    │   └── project.json
    ├── src
    │   ├── app
    │   │   ├── api
    │   │   │   ├── auth
    │   │   │   │   └── telegram
    │   │   │   │       └── route.js
    │   │   │   └── extract-data
    │   │   │       ├── route-workingversion071024.js
    │   │   │       ├── route-workingversion081024.js
    │   │   │       ├── route-workingversion081024v2.js
    │   │   │       ├── route-workingversion081024v3.js
    │   │   │       └── route.js
    │   │   ├── contacts
    │   │   │   └── page.js
    │   │   ├── contacts-list
    │   │   │   └── page.jsx
    │   │   ├── dashboard
    │   │   │   └── page.js
    │   │   ├── groups
    │   │   │   └── page.js
    │   │   ├── groups-list
    │   │   │   └── page.jsx
    │   │   ├── global.css
    │   │   ├── layout.js
    │   │   └── page.js
    │   ├── components
    │   │   ├── ui
    │   │   │   ├── alert.jsx
    │   │   │   ├── avatar.jsx
    │   │   │   ├── badge.jsx
    │   │   │   ├── button.jsx
    │   │   │   ├── card.jsx
    │   │   │   ├── checkbox.jsx
    │   │   │   ├── input.jsx
    │   │   │   ├── label.jsx
    │   │   │   ├── radio-group.jsx
    │   │   │   ├── table.jsx
    │   │   │   └── tabs.jsx
    │   │   ├── ClientTelegramManager.js
    │   │   ├── ContactsList.jsx
    │   │   ├── GroupsList.jsx
    │   │   ├── TelegramManager-workingversion071024.jsx
    │   │   ├── TelegramManager-workingversion081024.jsx
    │   │   ├── TelegramManager-workingversion081024v2.jsx
    │   │   ├── TelegramManager-workingversion081024v3.jsx
    │   │   └── TelegramManager.jsx
    │   └── lib
    │       ├── apiUtils.js
    │       ├── csvUtils.js
    │       ├── supabase.js
    │       └── utils.js
    ├── utils
    │   └── config.js
    ├── .eslintrc.js
    ├── .gitignore
    ├── .vercelignore
    ├── components.json
    ├── jsconfig.json
    ├── next.config.js
    ├── package.json
    ├── postcss.config.js
    ├── project-process.md
    ├── route-working.js
    ├── tailwind.config.js
    ├── TelegramManager-working.jsx
    └── vercel.json



---
File: /.vercel/project.json
---

{
  "projectId": "prj_367vtzPiZn5QirP92psBaoa7hv06",
  "orgId": "team_ArZ7x4AdcyPVl4hDW9jRBNul",
  "settings": {
    "createdAt": 1727471692304,
    "framework": null,
    "devCommand": null,
    "installCommand": null,
    "buildCommand": null,
    "outputDirectory": null,
    "rootDirectory": null,
    "directoryListing": false,
    "nodeVersion": "20.x"
  }
}



---
File: /src/app/api/auth/telegram/route.js
---

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    // Check authenticity of the request
    const checkString = Object.entries({ auth_date, first_name, id, username })
      .sort()
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secret = crypto.createHash('sha256').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (expectedHash !== hash) {
      return NextResponse.json({ error: 'Invalid data from Telegram' }, { status: 400 });
    }

    // Upsert user into Supabase
    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        telegram_id: id,
        first_name,
        last_name,
        username,
        photo_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}



---
File: /src/app/api/extract-data/route-workingversion071024.js
---

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
    }

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
        .eq('id', user.id);

      if (clearError) {
        console.error('[CLEAR HASH ERROR]:', clearError);
        // Not throwing here as it's not critical
      }

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
  }
  // Note: We've removed the client disconnect logic as requested
}



---
File: /src/app/api/extract-data/route-workingversion081024.js
---

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



---
File: /src/app/api/extract-data/route-workingversion081024v2.js
---

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

// Persistent TelegramClient instance
let persistentClient;

async function getPersistentClient(apiId, apiHash) {
  if (!persistentClient) {
    const stringSession = new StringSession('');
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

    // Get or initialize the persistent TelegramClient
    const client = await getPersistentClient(apiId, apiHash);

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
          message: 'Validation code sent to your Telegram app. Please provide it in the next step.',
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
  }
}



---
File: /src/app/api/extract-data/route-workingversion081024v3.js
---

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
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error('[ERROR]: Failed to parse request body', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { apiId, apiHash, phoneNumber, extractType, validationCode, action } = body;

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

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';



---
File: /src/app/api/extract-data/route.js
---

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

// Persistent TelegramClient instance
let persistentClient;

async function getPersistentClient(apiId, apiHash, session = '') {
  if (!persistentClient) {
    const stringSession = new StringSession(session);
    persistentClient = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 3,
      useWSS: true,
      timeout: 20000, // Reduced timeout to 20 seconds
      dev: false,
    });
    try {
      await Promise.race([
        persistentClient.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 25000))
      ]);
    } catch (error) {
      console.error('[CONNECTION ERROR]:', error);
      persistentClient = null;
      throw error;
    }
  }
  return persistentClient;
}

export async function POST(req) {
  try {
    console.log('[START]: Handling API Request');
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error('[ERROR]: Failed to parse request body', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { apiId, apiHash, phoneNumber, extractType, validationCode, action } = body;

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

    try {
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
      console.error('[TELEGRAM CONNECTION ERROR]:', error);
      return NextResponse.json({ 
        error: 'Failed to connect to Telegram servers. Please try again later.',
        details: error.message
      }, { status: 503 });
    }

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

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';



---
File: /src/app/contacts/page.js
---

'use client'

import ContactsList from '@/components/ContactsList'

export default function ContactsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Telegram Contacts</h1>
      <ContactsList />
    </div>
  )
}



---
File: /src/app/contacts-list/page.jsx
---

import React from 'react';

const ContactsListPage = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Contacts List</h1>
      <p>This page will display the extracted contacts.</p>
    </div>
  );
};

export default ContactsListPage;


---
File: /src/app/dashboard/page.js
---

'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
      } else {
        router.push('/');
      }
    };

    checkUser();
  }, [router]);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Welcome, {user.username || user.first_name}!</h1>
      {/* Add dashboard content here */}
    </div>
  );
}



---
File: /src/app/groups/page.js
---

'use client'

import GroupsList from '@/components/GroupsList'

export default function GroupsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Telegram Groups</h1>
      <GroupsList />
    </div>
  )
}



---
File: /src/app/groups-list/page.jsx
---

import React from 'react';
import { supabase } from '@/lib/apiUtils';

const GroupsList = async () => {
  const { data: groups, error } = await supabase.from('groups').select('*');

  if (error) {
    console.error('Error fetching groups:', error);
    return <div>Error loading groups</div>;
  }

  return (
    <div>
      <h1>Groups List</h1>
      <ul>
        {groups.map((group) => (
          <li key={group.id}>{group.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default GroupsList;


---
File: /src/app/global.css
---

@tailwind base;
@tailwind components;
@tailwind utilities;



---
File: /src/app/layout.js
---

import './global.css'

export const metadata = {
  title: 'Telegram Groups and Contacts Extractor',
  description: 'Extract Telegram Groups and Contacts easily',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">{children}</body>
    </html>
  )
}



---
File: /src/app/page.js
---

'use client'

import TelegramManager from '../components/TelegramManager';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 md:p-24">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8">Telegram Extractor</h1>
      <TelegramManager />
    </main>
  )
}



---
File: /src/components/ui/alert.jsx
---

import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };



---
File: /src/components/ui/avatar.jsx
---

import * as React from "react"

export const Avatar = ({ children }) => <div className="rounded-full overflow-hidden">{children}</div>
export const AvatarImage = ({ src, alt }) => <img className="w-full h-full object-cover" src={src} alt={alt} />
export const AvatarFallback = ({ children }) => <div className="w-full h-full bg-gray-300">{children}</div>




---
File: /src/components/ui/badge.jsx
---

import * as React from "react"

export const Badge = ({ children, variant = "default" }) => {
  const variants = {
    default: "bg-gray-200 text-gray-800",
    success: "bg-green-200 text-green-800",
    error: "bg-red-200 text-red-800",
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded ${variants[variant]}`}>
      {children}
    </span>
  )
}



---
File: /src/components/ui/button.jsx
---

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";


const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };



---
File: /src/components/ui/card.jsx
---

import * as React from "react"
import PropTypes from "prop-types"
import { cn } from "@/lib/utils"

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// PropTypes
const sharedPropTypes = {
  className: PropTypes.string,
}

Card.propTypes = sharedPropTypes
CardHeader.propTypes = sharedPropTypes
CardTitle.propTypes = sharedPropTypes
CardDescription.propTypes = sharedPropTypes
CardContent.propTypes = sharedPropTypes
CardFooter.propTypes = sharedPropTypes

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }



---
File: /src/components/ui/checkbox.jsx
---

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "@radix-ui/react-icons"
import PropTypes from "prop-types"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <CheckIcon className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))

Checkbox.displayName = CheckboxPrimitive.Root.displayName

Checkbox.propTypes = {
  className: PropTypes.string,
}

export { Checkbox }



---
File: /src/components/ui/input.jsx
---

import * as React from "react"
import PropTypes from "prop-types"
import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";

Input.propTypes = {
  className: PropTypes.string,
  type: PropTypes.string,
};

export { Input };



---
File: /src/components/ui/label.jsx
---

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva } from "class-variance-authority"
import PropTypes from "prop-types"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))

Label.displayName = LabelPrimitive.Root.displayName

Label.propTypes = {
  className: PropTypes.string,
  // Add other prop types as needed
}

export { Label }



---
File: /src/components/ui/radio-group.jsx
---

import * as React from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import PropTypes from "prop-types";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  );
});

RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

RadioGroup.propTypes = {
  className: PropTypes.string,
};

const RadioGroupItem = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <CheckIcon className="h-3.5 w-3.5 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});

RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

RadioGroupItem.propTypes = {
  className: PropTypes.string,
};

export { RadioGroup, RadioGroupItem };



---
File: /src/components/ui/table.jsx
---

import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn("w-full caption-bottom text-sm", className)}
    {...props}
  />
));
Table.displayName = "Table";

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("bg-primary font-medium text-primary-foreground", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};



---
File: /src/components/ui/tabs.jsx
---

// src/components/ui/tabs.jsx
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }


---
File: /src/components/ClientTelegramManager.js
---

'use client';

import TelegramManager from './TelegramManager';

export default function ClientTelegramManager() {
  return <TelegramManager />;
}



---
File: /src/components/ContactsList.jsx
---

'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from '@/lib/supabase';
import { generateCSV } from '@/lib/csvUtils';

export default function ContactsList() {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('*'); // Ensure filtering by user_id if necessary

        if (error) throw error;
        setContacts(data);
      } catch (error) {
        console.error('Error fetching contacts:', error);
        setError('Failed to load contacts. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContacts();
  }, []);

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    setSelectedContacts(selectAll ? [] : contacts.map(contact => contact.id));
  };

  const handleSelectContact = (contactId) => {
    setSelectedContacts(prevSelected =>
      prevSelected.includes(contactId)
        ? prevSelected.filter(id => id !== contactId)
        : [...prevSelected, contactId]
    );
  };

  const handleExtract = async () => {
    try {
      const selectedData = contacts.filter(contact => selectedContacts.includes(contact.id));
      const csvContent = generateCSV(selectedData, ['id', 'first_name', 'last_name', 'username', 'phone_number', 'bio', 'online_status']);
      downloadCSV(csvContent, 'extracted_contacts.csv');
    } catch (error) {
      console.error('Error extracting contacts:', error);
      setError('Failed to extract contacts. Please try again.');
    }
  };

  const downloadCSV = (content, fileName) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Contacts List</h2>
      <Checkbox
        id="select-all"
        checked={selectAll}
        onCheckedChange={handleSelectAll}
        label={selectAll ? "Unselect All" : "Select All"}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Select</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Bio</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>
                <Checkbox
                  checked={selectedContacts.includes(contact.id)}
                  onCheckedChange={() => handleSelectContact(contact.id)}
                />
              </TableCell>
              <TableCell>{`${contact.first_name} ${contact.last_name}`}</TableCell>
              <TableCell>{contact.username}</TableCell>
              <TableCell>{contact.phone_number}</TableCell>
              <TableCell>{contact.bio}</TableCell>
              <TableCell>
                <span className={contact.online_status === 'Online' ? 'text-green-500' : 'text-gray-500'}>
                  {contact.online_status || 'Offline'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={handleExtract} disabled={selectedContacts.length === 0}>Extract Selected Contacts</Button>
    </div>
  );
}



---
File: /src/components/GroupsList.jsx
---

'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from '@/lib/supabase';
import { generateCSV } from '@/lib/csvUtils';

export default function GroupsList() {
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase
          .from('groups')
          .select('*'); // Ensure filtering by user_id if necessary

        if (error) throw error;
        setGroups(data);
      } catch (error) {
        console.error('Error fetching groups:', error);
        setError('Failed to load groups. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    setSelectedGroups(selectAll ? [] : groups.map(group => group.id));
  };

  const handleSelectGroup = (groupId) => {
    setSelectedGroups(prevSelected =>
      prevSelected.includes(groupId)
        ? prevSelected.filter(id => id !== groupId)
        : [...prevSelected, groupId]
    );
  };

  const handleExtract = async () => {
    try {
      const selectedData = groups.filter(group => selectedGroups.includes(group.id));
      const csvContent = generateCSV(selectedData, ['id', 'group_name', 'description', 'invite_link']);
      downloadCSV(csvContent, 'extracted_groups.csv');
    } catch (error) {
      console.error('Error extracting groups:', error);
      setError('Failed to extract groups. Please try again.');
    }
  };

  const downloadCSV = (content, fileName) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Groups List</h2>
      <Checkbox
        id="select-all"
        checked={selectAll}
        onCheckedChange={handleSelectAll}
        label={selectAll ? "Unselect All" : "Select All"}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Select</TableHead>
            <TableHead>Group Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Invite Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.id}>
              <TableCell>
                <Checkbox
                  checked={selectedGroups.includes(group.id)}
                  onCheckedChange={() => handleSelectGroup(group.id)}
                />
              </TableCell>
              <TableCell>{group.group_name}</TableCell>
              <TableCell>{group.description}</TableCell>
              <TableCell>
                <a href={group.invite_link} target="_blank" rel="noopener noreferrer">
                  {group.invite_link}
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={handleExtract} disabled={selectedGroups.length === 0}>Extract Selected Groups</Button>
    </div>
  );
}



---
File: /src/components/TelegramManager-workingversion071024.jsx
---

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function TelegramManager() {
  const router = useRouter()
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [extractType, setExtractType] = useState('groups')
  const [validationCode, setValidationCode] = useState('')
  const [showValidationInput, setShowValidationInput] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [codeRequestTime, setCodeRequestTime] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (showValidationInput && codeRequestTime) {
      const timer = setTimeout(() => {
        setError('Code expired. Please request a new one.')
        setShowValidationInput(false)
        setValidationCode('')
        setCodeRequestTime(null)
      }, 120000) // 2 minutes expiration
      return () => clearTimeout(timer)
    }
  }, [showValidationInput, codeRequestTime])

  const validateInputs = () => {
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a valid positive number')
      return false
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string')
      return false
    }
    if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber.trim())) {
      setError('Please enter a valid phone number with country code (e.g., +1234567890)')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!validateInputs()) {
      setIsLoading(false)
      return
    }

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType,
        validationCode: showValidationInput ? validationCode : undefined,
      }

      console.log('[DEBUG]: Submitting request with:', {
        ...payload,
        apiHash: '******',
        phoneNumber: '*******' + payload.phoneNumber.slice(-4),
        validationCode: payload.validationCode ? '******' : undefined,
      })

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log('[DEBUG]: Received response:', data)

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to process request')
      }

      if (data.requiresValidation) {
        setShowValidationInput(true)
        setCodeRequestTime(new Date())
        setError(null)
        alert('Please enter the validation code sent to your Telegram app.')
      } else if (data.success) {
        if (showValidationInput) {
          setIsAuthenticated(true)
          setShowValidationInput(false)
          alert('Authentication successful. You can now extract data.')
        } else if (data.data) {
          alert(`Extracted ${data.data.length} ${extractType}`)
          router.push(`/${extractType}-list`)
        }
      } else {
        setError(data.message || 'An unexpected error occurred. Please try again.')
      }
    } catch (error) {
      console.error('[ERROR]: Submit failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Telegram Extractor</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Telegram Extractor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-id">API ID</Label>
              <Input
                id="api-id"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-hash">API Hash</Label>
              <Input
                id="api-hash"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API Hash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your phone number (with country code)"
              />
            </div>
            <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groups" id="groups" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="groups">Extract Groups</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contacts" id="contacts" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="contacts">Extract Contacts</Label>
              </div>
            </RadioGroup>
            {showValidationInput && (
              <div className="space-y-2">
                <Label htmlFor="validation-code">Validation Code</Label>
                <Input
                  id="validation-code"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Enter the code sent to your Telegram app"
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                (isAuthenticated ? 'Extract Data' : 
                  (showValidationInput ? 'Verify Code' : 'Request Code'))}
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



---
File: /src/components/TelegramManager-workingversion081024.jsx
---

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const CODE_EXPIRATION_TIME = 30 * 60; // 30 minutes in seconds

export default function TelegramManager() {
  const router = useRouter()
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [extractType, setExtractType] = useState('groups')
  const [validationCode, setValidationCode] = useState('')
  const [showValidationInput, setShowValidationInput] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [codeRequestTime, setCodeRequestTime] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(CODE_EXPIRATION_TIME)
  const [isPhoneRegistered, setIsPhoneRegistered] = useState(null)

  useEffect(() => {
    let timer
    if (showValidationInput && codeRequestTime) {
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - codeRequestTime) / 1000)
        const remaining = Math.max(CODE_EXPIRATION_TIME - elapsed, 0)
        setTimeRemaining(remaining)
        if (remaining === 0) {
          setError('Code expired. Please request a new one.')
          setShowValidationInput(false)
          setValidationCode('')
          setCodeRequestTime(null)
        }
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [showValidationInput, codeRequestTime])

  const validateInputs = () => {
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a valid positive number')
      return false
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string')
      return false
    }
    if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber.trim())) {
      setError('Please enter a valid phone number with country code (e.g., +1234567890)')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsLoading(true)

    if (!validateInputs()) {
      setIsLoading(false)
      return
    }

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType,
        validationCode: showValidationInput ? validationCode : undefined,
      }

      console.log('[DEBUG]: Submitting request with:', {
        ...payload,
        apiHash: '******',
        phoneNumber: '*******' + payload.phoneNumber.slice(-4),
        validationCode: payload.validationCode ? '******' : undefined,
      })

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log('[DEBUG]: Received response:', data)

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('This phone number is already registered. Please use a different number or try again later.');
        }
        throw new Error(data.error?.message || 'Failed to process request')
      }

      if (data.requiresValidation) {
        setShowValidationInput(true)
        setCodeRequestTime(Date.now())
        setTimeRemaining(CODE_EXPIRATION_TIME)
        setIsPhoneRegistered(data.phoneRegistered)
        setSuccessMessage(`Validation code sent to your phone. ${data.phoneRegistered ? 'Your phone is registered.' : 'Your phone is not registered and will be signed up.'}`)
      } else if (data.success) {
        if (showValidationInput) {
          setIsAuthenticated(true)
          setShowValidationInput(false)
          setSuccessMessage('Authentication successful. You can now extract data.')
        } else if (data.data) {
          setSuccessMessage(`Extracted ${data.data.length} ${extractType}`)
          setTimeout(() => router.push(`/${extractType}-list`), 2000)
        }
      } else if (data.code === 'PHONE_CODE_EXPIRED') {
        setError('The verification code has expired. Please request a new code.')
        setShowValidationInput(false)
        setValidationCode('')
        setCodeRequestTime(null)
      } else {
        setError(data.message || 'An unexpected error occurred. Please try again.')
      }
    } catch (error) {
      console.error('[ERROR]: Submit failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const renderTimer = () => {
    const minutes = Math.floor(timeRemaining / 60)
    const seconds = timeRemaining % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Telegram Extractor</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Telegram Extractor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-id">API ID</Label>
              <Input
                id="api-id"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-hash">API Hash</Label>
              <Input
                id="api-hash"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API Hash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your phone number (with country code)"
              />
            </div>
            <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groups" id="groups" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="groups">Extract Groups</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contacts" id="contacts" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="contacts">Extract Contacts</Label>
              </div>
            </RadioGroup>
            {showValidationInput && (
              <div className="space-y-2">
                <Label htmlFor="validation-code">Validation Code</Label>
                <Input
                  id="validation-code"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Enter the code sent to your Telegram app"
                />
                <p className="text-sm text-gray-500">Code expires in: {renderTimer()}</p>
                {isPhoneRegistered !== null && (
                  <p className="text-sm text-blue-500">
                    {isPhoneRegistered ? 'Phone is registered.' : 'Phone is not registered and will be signed up.'}
                  </p>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                (isAuthenticated ? 'Extract Data' : 
                  (showValidationInput ? 'Verify Code' : 'Request Code'))}
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert className="mt-4">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



---
File: /src/components/TelegramManager-workingversion081024v2.jsx
---

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const CODE_EXPIRATION_TIME = 30 * 60; // 30 minutes in seconds

export default function TelegramManager() {
  const router = useRouter()
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [extractType, setExtractType] = useState('groups')
  const [validationCode, setValidationCode] = useState('')
  const [showValidationInput, setShowValidationInput] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [codeRequestTime, setCodeRequestTime] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(CODE_EXPIRATION_TIME)
  const [isPhoneRegistered, setIsPhoneRegistered] = useState(null)

  useEffect(() => {
    let timer
    if (showValidationInput && codeRequestTime) {
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - codeRequestTime) / 1000)
        const remaining = Math.max(CODE_EXPIRATION_TIME - elapsed, 0)
        setTimeRemaining(remaining)
        if (remaining === 0) {
          setError('Code expired. Please request a new one.')
          setShowValidationInput(false)
          setValidationCode('')
          setCodeRequestTime(null)
        }
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [showValidationInput, codeRequestTime])

  const validateInputs = () => {
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a valid positive number')
      return false
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string')
      return false
    }
    if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber.trim())) {
      setError('Please enter a valid phone number with country code (e.g., +1234567890)')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsLoading(true)

    if (!validateInputs()) {
      setIsLoading(false)
      return
    }

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType,
        validationCode: showValidationInput ? validationCode : undefined,
      }

      console.log('[DEBUG]: Submitting request with:', {
        ...payload,
        apiHash: '******',
        phoneNumber: '*******' + payload.phoneNumber.slice(-4),
        validationCode: payload.validationCode ? '******' : undefined,
      })

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log('[DEBUG]: Received response:', data)

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('This phone number is already registered. Please use a different number or try again later.');
        }
        throw new Error(data.error?.message || 'Failed to process request')
      }

      if (data.requiresValidation) {
        setShowValidationInput(true)
        setCodeRequestTime(Date.now())
        setTimeRemaining(CODE_EXPIRATION_TIME)
        setIsPhoneRegistered(data.phoneRegistered)
        setSuccessMessage(`Validation code sent to your Telegram app. ${data.phoneRegistered ? 'Your phone is registered.' : 'Your phone is not registered and will be signed up.'}`)
      } else if (data.success) {
        if (showValidationInput) {
          setIsAuthenticated(true)
          setShowValidationInput(false)
          setSuccessMessage('Authentication successful. You can now extract data.')
        } else if (data.data) {
          setSuccessMessage(`Extracted ${data.data.length} ${extractType}`)
          setTimeout(() => router.push(`/${extractType}-list`), 2000)
        }
      } else if (data.code === 'PHONE_CODE_EXPIRED') {
        setError('The verification code has expired. Please request a new code.')
        setShowValidationInput(false)
        setValidationCode('')
        setCodeRequestTime(null)
      } else {
        setError(data.message || 'An unexpected error occurred. Please try again.')
      }
    } catch (error) {
      console.error('[ERROR]: Submit failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const renderTimer = () => {
    const minutes = Math.floor(timeRemaining / 60)
    const seconds = timeRemaining % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Telegram Extractor</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Telegram Extractor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-id">API ID</Label>
              <Input
                id="api-id"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-hash">API Hash</Label>
              <Input
                id="api-hash"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API Hash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your phone number (with country code)"
              />
            </div>
            <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groups" id="groups" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="groups">Extract Groups</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contacts" id="contacts" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="contacts">Extract Contacts</Label>
              </div>
            </RadioGroup>
            {showValidationInput && (
              <div className="space-y-2">
                <Label htmlFor="validation-code">Validation Code</Label>
                <Input
                  id="validation-code"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Enter the code sent to your Telegram app"
                />
                <p className="text-sm text-gray-500">Code expires in: {renderTimer()}</p>
                <p className="text-sm text-blue-500">
                  Please check your Telegram app for the verification code.
                </p>
                {isPhoneRegistered !== null && (
                  <p className="text-sm text-blue-500">
                    {isPhoneRegistered ? 'Phone is registered.' : 'Phone is not registered and will be signed up.'}
                  </p>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                (isAuthenticated ? 'Extract Data' : 
                  (showValidationInput ? 'Verify Code' : 'Request Code'))}
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert className="mt-4">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



---
File: /src/components/TelegramManager-workingversion081024v3.jsx
---

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const CODE_EXPIRATION_TIME = 30 * 60; // 30 minutes in seconds

export default function TelegramManager() {
  const router = useRouter()
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [extractType, setExtractType] = useState('groups')
  const [validationCode, setValidationCode] = useState('')
  const [showValidationInput, setShowValidationInput] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [codeRequestTime, setCodeRequestTime] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(CODE_EXPIRATION_TIME)
  const [isPhoneRegistered, setIsPhoneRegistered] = useState(null)
  const [hasExistingSession, setHasExistingSession] = useState(false)

  useEffect(() => {
    const checkExistingSession = async () => {
      if (phoneNumber && apiId && apiHash) {
        setIsLoading(true)
        try {
          const response = await fetch('/api/extract-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'checkSession', 
              phoneNumber: phoneNumber.trim(),
              apiId: parseInt(apiId),
              apiHash
            }),
          });
          const data = await response.json();
          setHasExistingSession(data.hasSession);
          if (data.hasSession) {
            setIsAuthenticated(true);
            setSuccessMessage('You have an existing session. You can proceed with data extraction.');
          }
        } catch (error) {
          console.error('Failed to check session:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    checkExistingSession();
  }, [phoneNumber, apiId, apiHash]);

  useEffect(() => {
    let timer
    if (showValidationInput && codeRequestTime) {
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - codeRequestTime) / 1000)
        const remaining = Math.max(CODE_EXPIRATION_TIME - elapsed, 0)
        setTimeRemaining(remaining)
        if (remaining === 0) {
          setError('Code expired. Please request a new one.')
          setShowValidationInput(false)
          setValidationCode('')
          setCodeRequestTime(null)
        }
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [showValidationInput, codeRequestTime])

  const validateInputs = () => {
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a valid positive number')
      return false
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string')
      return false
    }
    if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber.trim())) {
      setError('Please enter a valid phone number with country code (e.g., +1234567890)')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsLoading(true)

    if (!validateInputs()) {
      setIsLoading(false)
      return
    }

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType,
        validationCode: showValidationInput ? validationCode : undefined,
      }

      console.log('[DEBUG]: Submitting request with:', {
        ...payload,
        apiHash: '******',
        phoneNumber: '*******' + payload.phoneNumber.slice(-4),
        validationCode: payload.validationCode ? '******' : undefined,
      })

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('[ERROR]: Failed to parse JSON response:', jsonError);
        throw new Error('Server returned an invalid response. Please try again.');
      }

      console.log('[DEBUG]: Received response:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request')
      }

      if (data.requiresValidation) {
        setShowValidationInput(true)
        setCodeRequestTime(Date.now())
        setTimeRemaining(CODE_EXPIRATION_TIME)
        setIsPhoneRegistered(data.phoneRegistered)
        setSuccessMessage(`Validation code sent to your Telegram app. ${data.phoneRegistered ? 'Your phone is registered.' : 'Your phone is not registered and will be signed up.'}`)
      } else if (data.success) {
        if (showValidationInput || hasExistingSession) {
          setIsAuthenticated(true)
          setShowValidationInput(false)
          setSuccessMessage('Authentication successful. You can now extract data.')
        } else if (data.data) {
          setSuccessMessage(`Extracted ${data.data.length} ${extractType}`)
          setTimeout(() => router.push(`/${extractType}-list`), 2000)
        }
      } else if (data.code === 'PHONE_CODE_EXPIRED') {
        setError('The verification code has expired. Please request a new code.')
        setShowValidationInput(false)
        setValidationCode('')
        setCodeRequestTime(null)
      } else {
        setError(data.message || 'An unexpected error occurred. Please try again.')
      }
    } catch (error) {
      console.error('[ERROR]: Submit failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const renderTimer = () => {
    const minutes = Math.floor(timeRemaining / 60)
    const seconds = timeRemaining % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Telegram Extractor</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Telegram Extractor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-id">API ID</Label>
              <Input
                id="api-id"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-hash">API Hash</Label>
              <Input
                id="api-hash"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API Hash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your phone number (with country code)"
              />
            </div>
            <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groups" id="groups" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="groups">Extract Groups</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contacts" id="contacts" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="contacts">Extract Contacts</Label>
              </div>
            </RadioGroup>
            {showValidationInput && !hasExistingSession && (
              <div className="space-y-2">
                <Label htmlFor="validation-code">Validation Code</Label>
                <Input
                  id="validation-code"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Enter the code sent to your Telegram app"
                />
                <p className="text-sm text-gray-500">Code expires in: {renderTimer()}</p>
                <p className="text-sm text-blue-500">
                  Please check your Telegram app for the verification code.
                </p>
                {isPhoneRegistered !== null && (
                  <p className="text-sm text-blue-500">
                    {isPhoneRegistered ? 'Phone is registered.' : 'Phone is not registered and will be signed up.'}
                  </p>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                (isAuthenticated ? 'Extract Data' : 
                  (showValidationInput ? 'Verify Code' : 'Request Code'))}
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert className="mt-4">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



---
File: /src/components/TelegramManager.jsx
---

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const CODE_EXPIRATION_TIME = 30 * 60; // 30 minutes in seconds

export default function TelegramManager() {
  const router = useRouter()
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [extractType, setExtractType] = useState('groups')
  const [validationCode, setValidationCode] = useState('')
  const [showValidationInput, setShowValidationInput] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [codeRequestTime, setCodeRequestTime] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(CODE_EXPIRATION_TIME)
  const [isPhoneRegistered, setIsPhoneRegistered] = useState(null)
  const [hasExistingSession, setHasExistingSession] = useState(false)

  useEffect(() => {
    const checkExistingSession = async () => {
      if (phoneNumber && apiId && apiHash) {
        setIsLoading(true)
        try {
          const response = await fetch('/api/extract-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'checkSession', 
              phoneNumber: phoneNumber.trim(),
              apiId: parseInt(apiId),
              apiHash
            }),
          });
          if (!response.ok) {
            throw new Error('Failed to check session');
          }
          const data = await response.json();
          setHasExistingSession(data.hasSession);
          if (data.hasSession) {
            setIsAuthenticated(true);
            setSuccessMessage('You have an existing session. You can proceed with data extraction.');
          }
        } catch (error) {
          console.error('Failed to check session:', error);
          setError('Failed to check for existing session. Please try again.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    checkExistingSession();
  }, [phoneNumber, apiId, apiHash]);

  useEffect(() => {
    let timer
    if (showValidationInput && codeRequestTime) {
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - codeRequestTime) / 1000)
        const remaining = Math.max(CODE_EXPIRATION_TIME - elapsed, 0)
        setTimeRemaining(remaining)
        if (remaining === 0) {
          setError('Code expired. Please request a new one.')
          setShowValidationInput(false)
          setValidationCode('')
          setCodeRequestTime(null)
        }
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [showValidationInput, codeRequestTime])

  const validateInputs = () => {
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a valid positive number')
      return false
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string')
      return false
    }
    if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber.trim())) {
      setError('Please enter a valid phone number with country code (e.g., +1234567890)')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsLoading(true)

    if (!validateInputs()) {
      setIsLoading(false)
      return
    }

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType,
        validationCode: showValidationInput ? validationCode : undefined,
      }

      console.log('[DEBUG]: Submitting request with:', {
        ...payload,
        apiHash: '******',
        phoneNumber: '*******' + payload.phoneNumber.slice(-4),
        validationCode: payload.validationCode ? '******' : undefined,
      })

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('Unable to connect to Telegram servers. Please try again later.');
        }
        throw new Error('Server returned an error. Please try again.');
      }

      const data = await response.json();
      console.log('[DEBUG]: Received response:', data)

      if (data.requiresValidation) {
        setShowValidationInput(true)
        setCodeRequestTime(Date.now())
        setTimeRemaining(CODE_EXPIRATION_TIME)
        setIsPhoneRegistered(data.phoneRegistered)
        setSuccessMessage(`Validation code sent to your Telegram app. ${data.phoneRegistered ? 'Your phone is registered.' : 'Your phone is not registered and will be signed up.'}`)
      } else if (data.success) {
        if (showValidationInput || hasExistingSession) {
          setIsAuthenticated(true)
          setShowValidationInput(false)
          setSuccessMessage('Authentication successful. You can now extract data.')
        } else if (data.data) {
          setSuccessMessage(`Extracted ${data.data.length} ${extractType}`)
          setTimeout(() => router.push(`/${extractType}-list`), 2000)
        }
      } else if (data.code === 'PHONE_CODE_EXPIRED') {
        setError('The verification code has expired. Please request a new code.')
        setShowValidationInput(false)
        setValidationCode('')
        setCodeRequestTime(null)
      } else {
        setError(data.message || 'An unexpected error occurred. Please try again.')
      }
    } catch (error) {
      console.error('[ERROR]: Submit failed:', error)
      setError(error.message || 'An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const renderTimer = () => {
    const minutes = Math.floor(timeRemaining / 60)
    const seconds = timeRemaining % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Telegram Extractor</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Telegram Extractor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-id">API ID</Label>
              <Input
                id="api-id"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-hash">API Hash</Label>
              <Input
                id="api-hash"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API Hash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your phone number (with country code)"
              />
            </div>
            <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groups" id="groups" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="groups">Extract Groups</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contacts" id="contacts" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="contacts">Extract Contacts</Label>
              </div>
            </RadioGroup>
            {showValidationInput && !hasExistingSession && (
              <div className="space-y-2">
                <Label htmlFor="validation-code">Validation Code</Label>
                <Input
                  id="validation-code"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Enter the code sent to your Telegram app"
                />
                <p className="text-sm text-gray-500">Code expires in: {renderTimer()}</p>
                <p className="text-sm text-blue-500">
                  Please check your Telegram app for the verification code.
                </p>
                {isPhoneRegistered !== null && (
                  <p className="text-sm text-blue-500">
                    {isPhoneRegistered ? 'Phone is registered.' : 'Phone is not registered and will be signed up.'}
                  </p>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                (isAuthenticated ? 'Extract Data' : 
                  (showValidationInput ? 'Verify Code' : 'Request Code'))}
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert className="mt-4">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



---
File: /src/lib/apiUtils.js
---

import { FloodWaitError, errors } from 'telegram';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_BACKOFF_TIME = 60000; // 1 minute

let requestCount = 0;
let lastRequestTime = Date.now();
let backoffTime = 2000; // Start with 2 seconds

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function checkRateLimit() {
  const currentTime = Date.now();
  if (currentTime - lastRequestTime > 60000) {
    requestCount = 0;
    lastRequestTime = currentTime;
  }
  
  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    throw new Error('Rate limit exceeded');
  }

  requestCount++;
}

export async function handleTelegramError(error) {
  console.error('Telegram API error:', error);

  if (error.message.includes('PHONE_NUMBER_INVALID')) {
    return NextResponse.json({
      success: false,
      error: {
        code: 400,
        message: 'Invalid phone number. Please check and try again.'
      }
    }, { status: 400 });
  }
  if (error.message.includes('PHONE_CODE_INVALID')) {
    return NextResponse.json({
      success: false,
      error: {
        code: 400,
        message: 'Invalid verification code. Please try again.'
      }
    }, { status: 400 });
  }
  if (error.message.includes('PHONE_CODE_EXPIRED')) {
    return NextResponse.json({
      success: false,
      error: {
        code: 400,
        message: 'Verification code has expired. Please request a new one.'
      }
    }, { status: 400 });
  }
  if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
    return NextResponse.json({
      success: false,
      error: {
        code: 400,
        message: 'Two-factor authentication is enabled. Please disable it temporarily to use this service.'
      }
    }, { status: 400 });
  }
  else if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
    return NextResponse.json({
      success: false,
      error: {
        code: 401,
        message: 'The provided API credentials are invalid or have been revoked.'
      }
    }, { status: 401 });
  }
  else {
    return NextResponse.json({
      success: false,
      error: {
        code: 500,
        message: 'An unexpected error occurred. Please try again later.',
        details: error.toString()
      }
    }, { status: 500 });
  }
}

export function handleSupabaseError(error) {
  console.error('Supabase error:', error);
  return NextResponse.json({
    success: false,
    error: {
      code: 500,
      message: 'Database operation failed',
      details: error.toString()
    }
  }, { status: 500 });
}

export function handleErrorResponse(message, status = 500, error = null) {
  console.error('[ERROR RESPONSE]:', message);
  if (error && typeof error === 'object' && 'stack' in error) {
    console.error('[ERROR STACK]:', error.stack);
  }
  return NextResponse.json({
    success: false,
    error: {
      code: status,
      message,
      details: error ? error.toString() : undefined,
    },
  }, { status });
}



---
File: /src/lib/csvUtils.js
---

import { Parser } from 'json2csv';

export function generateCSV(data, fields) {
  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(data);
}



---
File: /src/lib/supabase.js
---

import { createClient } from '@supabase/supabase-js';

// Read the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check for missing environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
} else {
  console.log('Supabase environment variables loaded successfully');
}

// Create a supabase client instance
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Log successful client creation
console.log('Supabase client created successfully');

// Remove or comment out these console.log statements
// console.log('Supabase client created:', supabase);
// console.log("Supabase Config Loaded");


---
File: /src/lib/utils.js
---

// lib/utils.js
export function cn(...classes) {
    return classes.filter(Boolean).join(" ");
  }
  


---
File: /utils/config.js
---

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://tg-groups-contacts-managerv2.vercel.app/api';

export { API_BASE_URL };



---
File: /.eslintrc.js
---

module.exports = {
    extends: ['next/core-web-vitals'],
    rules: {
      // Disable TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }


---
File: /.gitignore
---

# Ignore Vercel deployment configurations
.vercel

# Ignore dependencies
node_modules/

# Ignore environment variables (for security)
.env
.env.local
.env.production
.env.development

# Ignore Python virtual environment (if applicable)
venv/

# Ignore Next.js build outputs
.next/

# Ignore any local build or distribution folders
dist/
build/

# Ignore IDE or editor configurations
.vscode/
.idea/
.editorconfig  # Only exclude if you don't need it in the repo

# Ignore macOS system files
.DS_Store

# Ignore log files and other temporary files
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Ignore coverage reports
coverage/
*.lcov

# Ignore test configurations and reports
*.test.js
*.spec.js
jest.config.js

# Ignore project documentation files
Project-code.md
.cursorrules

# Optional: Lock files should generally be included for consistent dependency versions
# package-lock.json
# yarn.lock

# Exclude specific unnecessary folders/files (modify if not needed)
.project-code/
.node_modules/

# Optional: Ignore temporary files created by your OS or editors
Thumbs.db



---
File: /.vercelignore
---

# Node modules should not be included in the repository, Vercel handles this
node_modules/

# Environment files (make sure to use environment variables on Vercel)
.env
.env.local
.env.production
.env.development

# Build output directories
.next/
dist/
build/

# Test and coverage reports (not needed in production)
tests/
coverage/
jest.config.js
*.test.js
*.spec.js

# IDE/Editor configurations (local settings)
.vscode/
.idea/

# Log files and temporary files
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.cursorrules

# Documentation and unnecessary files
README.md
*.md

# Python virtual environment (if applicable)
venv/

# OS-specific files
.DS_Store  # macOS
Thumbs.db  # Windows

# Optional: include lock files for consistent dependency versions across environments
# package-lock.json
# yarn.lock



---
File: /components.json
---

{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "styles/global.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}


---
File: /jsconfig.json
---

{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}



---
File: /next.config.js
---

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
  },
  typescript: {
    // It's recommended to remove this in production and fix type errors
    ignoreBuildErrors: true,
  },
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;



---
File: /package.json
---

{
  "name": "tg-groups-and-contacts-extractor",
  "version": "1.0.0",
  "description": "Telegram Groups and Contacts extractor",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "author": "ElPi",
  "license": "MIT",
  "engines": {
    "node": ">=16.0.0"
  },
  "dependencies": {
    "@mtproto/core": "^6.3.0",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-icons": "^1.3.0",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-radio-group": "^1.1.3",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-tabs": "^1.0.4",
    "@supabase/supabase-js": "^2.45.4",
    "class-variance-authority": "^0.7.0",
    "csv-stringify": "^6.4.4",
    "date-fns": "^2.30.0",
    "json2csv": "^6.0.0-alpha.2",
    "lucide-react": "^0.294.0",
    "next": "^14.0.3",
    "prop-types": "^15.8.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hot-toast": "^2.4.1",
    "telegram": "^2.25.15"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.0.0",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.0.0"
  }
}



---
File: /postcss.config.js
---

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}



---
File: /project-process.md
---

Process:
User Form Submission:

The user fills in the form with:
API ID
API Hash
Phone Number
Selects either "Extract Groups" or "Extract Contacts"
User clicks on Request Code.
What happens here:

The API should validate the inputs (API ID, API Hash, and Phone Number).
If validation passes, the API sends a request to Telegram to send the verification code to the user's phone number.
The user is created in Supabase if they don't already exist.
No data extraction happens at this stage—just the request for the verification code.
User Submits Verification Code:

The user receives the verification code on their phone.
They enter the verification code into the form and submit it.
What happens here:

The API takes the verification code and verifies it with Telegram.
Once verified, the API makes a request to Telegram to extract either groups or contacts, based on the user’s selection.
The extracted data is then stored in Supabase (either in the groups or contacts table).
____________________________________________________________________________



---
File: /route-working.js
---

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
    }

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
        .eq('id', user.id);

      if (clearError) {
        console.error('[CLEAR HASH ERROR]:', clearError);
        // Not throwing here as it's not critical
      }

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



---
File: /tailwind.config.js
---

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}



---
File: /TelegramManager-working.jsx
---

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function TelegramManager() {
  const router = useRouter()
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [extractType, setExtractType] = useState('groups')
  const [validationCode, setValidationCode] = useState('')
  const [showValidationInput, setShowValidationInput] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [codeRequestTime, setCodeRequestTime] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (showValidationInput && codeRequestTime) {
      const timer = setTimeout(() => {
        setError('Code expired. Please request a new one.')
        setShowValidationInput(false)
        setValidationCode('')
        setCodeRequestTime(null)
      }, 120000) // 2 minutes expiration
      return () => clearTimeout(timer)
    }
  }, [showValidationInput, codeRequestTime])

  const validateInputs = () => {
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a valid positive number')
      return false
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string')
      return false
    }
    if (!phoneNumber || phoneNumber.trim() === '') {
      setError('Please enter a valid phone number')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!validateInputs()) {
      setIsLoading(false)
      return
    }

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType,
        validationCode: showValidationInput ? validationCode : undefined,
      }

      console.log('[DEBUG]: Submitting request with:', {
        ...payload,
        apiHash: '******',
        phoneNumber: '*******' + payload.phoneNumber.slice(-4),
        validationCode: payload.validationCode ? '******' : undefined,
      })

      const response = await fetch('/api/telegram-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log('[DEBUG]: Received response:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request')
      }

      if (data.requiresValidation) {
        setShowValidationInput(true)
        setCodeRequestTime(new Date())
        setError(null)
        alert('Please enter the validation code sent to your Telegram app.')
      } else if (data.success) {
        setIsAuthenticated(true)
        setShowValidationInput(false)
        if (data.data) {
          alert(`Extracted ${data.data.length} ${extractType}`)
          // Here you might want to save the data or redirect to a results page
          router.push(`/${extractType}-list`)
        } else {
          alert('Authentication successful. You can now extract data.')
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } catch (error) {
      console.error('[ERROR]: Submit failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Telegram Extractor</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Telegram Extractor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-id">API ID</Label>
              <Input
                id="api-id"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-hash">API Hash</Label>
              <Input
                id="api-hash"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your API Hash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your phone number (with country code)"
              />
            </div>
            <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groups" id="groups" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="groups">Extract Groups</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contacts" id="contacts" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="contacts">Extract Contacts</Label>
              </div>
            </RadioGroup>
            {showValidationInput && (
              <div className="space-y-2">
                <Label htmlFor="validation-code">Validation Code</Label>
                <Input
                  id="validation-code"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Enter the code sent to your Telegram app"
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                (isAuthenticated ? 'Extract Data' : 
                  (showValidationInput ? 'Verify Code' : 'Request Code'))}
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



---
File: /vercel.json
---

{
  "version": 2,
  "builds": [
    {
      "src": "next.config.js",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1",
      "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      "headers": {
        "Access-Control-Allow-Origin": "*"
      }
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}

