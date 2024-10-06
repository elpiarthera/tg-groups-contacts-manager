import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiId, apiHash, phoneNumber } = req.body;

  const stringSession = new StringSession(''); // You can save the session string to avoid logging in every time
  const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
    connectionRetries: 5,
  });

  try {
    console.log('Starting client...');
    await client.start({
      phoneNumber: phoneNumber,
      phoneCode: async () => {
        // In a real scenario, you'd need to implement a way to get the phone code from the user
        // For now, we'll throw an error to indicate that phone code is required
        throw new Error('Phone code required. Please implement phone code retrieval.');
      },
      onError: (err) => console.log(err),
    });

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
