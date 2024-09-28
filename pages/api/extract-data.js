import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { apiId, apiHash, phoneNumber, extractType, selectedGroups } = req.body;

  if (!apiId || !apiHash || !phoneNumber || !extractType || !selectedGroups) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const client = new TelegramClient(new StringSession(''), parseInt(apiId), apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => phoneNumber,
      phoneCode: async () => await input.text('Please enter the code you received: '),
      onError: (err) => console.log(err),
    });

    const dialogs = await client.getDialogs();
    const groups = dialogs.filter(dialog => selectedGroups.includes(dialog.id.toString()));

    const extractedData = [];

    for (const group of groups) {
      const participants = await client.getParticipants(group);
      for (const user of participants) {
        const data = {
          group_name: group.title,
          group_id: group.id.toString(),
          member_name: user.firstName,
          username: user.username,
          user_id: user.id.toString()
        };
        extractedData.push(data);

        // Store the extracted data in Supabase
        await supabase.from('extracted_data').insert(data);
      }
    }

    await client.disconnect();

    res.status(200).json({ extractedData });
  } catch (error) {
    console.error('Error extracting data:', error);
    res.status(500).json({ error: 'Error extracting data', details: error.message });
  }
}
