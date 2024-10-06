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

Directory Structure:

└── ./
    ├── src
    │   ├── app
    │   │   ├── api
    │   │   │   ├── extract-data
    │   │   │   │   ├── route-working.js
    │   │   │   │   └── route.js
    │   │   │   └── telegram-extract.js
    │   │   ├── contacts
    │   │   │   └── page.js
    │   │   ├── contacts-list
    │   │   │   └── page.jsx
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
    │   │   ├── TelegramManager-working.jsx
    │   │   └── TelegramManager.jsx
    │   └── lib
    │       ├── apiUtils.js
    │       ├── csvUtils.js
    │       ├── supabase.js
    │       └── utils.js
    ├── utils
    │   └── config.js
    ├── .eslintrc.js
    ├── .vercelignore
    ├── components.json
    ├── h origin main:master
    ├── jsconfig.json
    ├── next.config.js
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    └── vercel.json



---
File: /src/app/api/extract-data/route-working.js
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


---
File: /src/app/api/telegram-extract.js
---

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiId, apiHash, phoneNumber } = req.body;

  try {
    // Check if user exists and has a valid session
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    let client;
    let sessionString = user?.session_string;

    if (sessionString) {
      // Reuse existing session
      const stringSession = new StringSession(sessionString);
      client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
        connectionRetries: 5,
      });

      try {
        await client.connect();
        console.log('Reused existing session');
      } catch (error) {
        console.error('Session reuse failed:', error);
        sessionString = null;
        // Clear invalid session
        await supabase
          .from('users')
          .update({ session_string: null })
          .eq('phone_number', phoneNumber);
      }
    }

    if (!sessionString) {
      // Create new session
      const stringSession = new StringSession('');
      client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
        connectionRetries: 5,
      });

      console.log('Starting new client...');
      await client.start({
        phoneNumber: phoneNumber,
        phoneCode: async () => {
          // In a real scenario, you'd need to implement a way to get the phone code from the user
          // For now, we'll throw an error to indicate that phone code is required
          throw new Error('Phone code required. Please implement phone code retrieval.');
        },
        onError: (err) => console.log(err),
      });

      // Save new session
      sessionString = client.session.save();
      await supabase
        .from('users')
        .upsert({ 
          phone_number: phoneNumber, 
          api_id: apiId, 
          api_hash: apiHash, 
          session_string: sessionString 
        });
    }

    console.log('Getting dialogs...');
    const dialogs = await client.getDialogs();
    const groups = dialogs.filter(dialog => dialog.isGroup || dialog.isChannel);

    const extractedData = [];

    for (const group of groups) {
      try {
        let groupLink = 'Private or No Link Available';
        try {
          const exportedInvite = await client.invoke(new Api.messages.ExportChatInvite({
            peer: group.id,
          }));
          groupLink = exportedInvite.link;
        } catch (e) {
          console.error(`Failed to get invite link for ${group.title}: ${e}`);
        }

        extractedData.push({
          group_name: group.title,
          group_id: group.id.toString(),
          group_link: groupLink,
        });

        // Add a delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
      } catch (error) {
        console.error(`Error processing group ${group.title}: ${error}`);
      }
    }

    await client.disconnect();
    res.status(200).json({ success: true, data: extractedData });
  } catch (error) {
    console.error('Error:', error);
    if (error.message.includes('Phone code required')) {
      res.status(400).json({ error: 'Phone code required for authentication. Please implement phone code retrieval in your frontend.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}



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
File: /src/components/TelegramManager-working.jsx
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
File: /src/components/TelegramManager.jsx
---

import React, { useState } from 'react'
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
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [requiresValidation, setRequiresValidation] = useState(false)

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

  const handleAuthenticate = async () => {
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
        action: 'authenticate',
      }

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to authenticate')
      }

      if (data.requiresValidation) {
        setRequiresValidation(true)
      } else {
        // Authentication successful, proceed to extraction
        handleExtract()
      }
    } catch (error) {
      console.error('[ERROR]: Authentication failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        validationCode,
        action: 'verify',
      }

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify')
      }

      // Verification successful, proceed to extraction
      handleExtract()
    } catch (error) {
      console.error('[ERROR]: Verification failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExtract = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType,
        action: 'extract',
      }

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract data')
      }

      alert(`Extracted ${data.data.length} ${extractType}`)
      router.push(`/${extractType}-list`)
    } catch (error) {
      console.error('[ERROR]: Extraction failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (requiresValidation) {
      handleVerify()
    } else {
      handleAuthenticate()
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
                disabled={isLoading || requiresValidation}
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
                disabled={isLoading || requiresValidation}
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
                disabled={isLoading || requiresValidation}
                placeholder="Enter your phone number (with country code)"
              />
            </div>
            {requiresValidation && (
              <div className="space-y-2">
                <Label htmlFor="validation-code">Validation Code</Label>
                <Input
                  id="validation-code"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Enter the validation code"
                />
              </div>
            )}
            <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groups" id="groups" disabled={isLoading} />
                <Label htmlFor="groups">Extract Groups</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contacts" id="contacts" disabled={isLoading} />
                <Label htmlFor="contacts">Extract Contacts</Label>
              </div>
            </RadioGroup>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (requiresValidation ? 'Verify' : 'Authenticate')}
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
File: /h origin main:master
---

[33mcommit 0c4a6a78842080bd0ac714787d69edec6ceac27e[m[33m ([m[1;36mHEAD -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m)[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sun Sep 29 20:22:28 2024 +0200

    Update Telegram Manager, API routes, and fix import issues

[33mcommit c20606efa3fa1e932967e5baf031e0a6dfa6b53d[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sun Sep 29 20:18:50 2024 +0200

    Update Supabase configuration and environment variables

[33mcommit a5d9c7bb05f8a7beb5fb316ad357f0eef5f12991[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sun Sep 29 20:09:40 2024 +0200

    MVP version ready for testing

[33mcommit 490e6a289dc8cd158ea7e75ba71296654f22d72f[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sat Sep 28 23:13:04 2024 +0200

    Configured API base URL and updated imports

[33mcommit de148b641169912ee3170388a55706c45580e55e[m
Author: elpiarthera <artherasmg@gmail.com>
Date:   Sat Sep 28 22:30:27 2024 +0200

    Updated TelegramManager to allow direct API ID, API Hash, and Phone Number submission



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
module.exports = {
    reactStrictMode: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    },
    // Add this section to ignore type checking during build
    typescript: {
      // !! WARN !!
      // Dangerously allow production builds to successfully complete even if
      // your project has type errors.
      // !! WARN !!
      ignoreBuildErrors: true,
    },
    // Add this to allow the use of top-level await in your application
    experimental: {
      esmExternals: 'loose',
    },
  }


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
    "node": ">=14.0.0"
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
    "@types/node": "^22.7.4",
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
    "autoprefixer": "^10.4.16",
    "eslint": "^8.0.0",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5"
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
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}

