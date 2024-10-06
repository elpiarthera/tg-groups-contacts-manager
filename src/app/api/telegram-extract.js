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
