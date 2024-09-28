import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { apiId, apiHash, phoneNumber } = req.body;

  if (!apiId || !apiHash || !phoneNumber) {
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
    const groups = dialogs
      .filter(dialog => dialog.isGroup || dialog.isChannel)
      .map(group => ({
        id: group.id.toString(),
        name: group.title,
        memberCount: group.participantsCount || 'Unknown'
      }));

    await client.disconnect();

    res.status(200).json(groups);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Error fetching data', details: error.message });
  }
}
