import { TelegramClient } from 'telethon';
import { StringSession } from 'telethon/sessions';
import { Api } from 'telethon/tl';

export async function POST(req) {
  console.log("Received fetch-data request");
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: `Method ${req.method} Not Allowed` }), {
      status: 405,
      headers: { 'Allow': ['POST'], 'Content-Type': 'application/json' }
    });
  }

  try {
    const { apiId, apiHash, phoneNumber, extractType, page = 1, pageSize = 50 } = await req.json();
    if (!apiId || !apiHash || !phoneNumber || !extractType) {
      throw new Error('Missing required parameters');
    }

    const client = new TelegramClient(new StringSession(''), parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.connect();
    // In a real-world scenario, you'd need to handle user authentication here
    // For now, we'll assume the user is already authenticated

    let extractedData, totalCount, hasMore;
    if (extractType === 'groups') {
      ({ data: extractedData, totalCount, hasMore } = await extractGroups(client, page, pageSize));
    } else if (extractType === 'contacts') {
      ({ data: extractedData, totalCount, hasMore } = await extractContacts(client, page, pageSize));
    } else {
      throw new Error('Invalid extract type');
    }

    await client.disconnect();

    return new Response(JSON.stringify({ extractedData, totalCount, hasMore, currentPage: page }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in API route:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function extractGroups(client, page, pageSize) {
  const dialogs = await client.getDialogs({
    limit: page * pageSize
  });
  const startIndex = (page - 1) * pageSize;
  const selectedGroups = dialogs.slice(startIndex, startIndex + pageSize);
  const extractedData = [];

  for (const group of selectedGroups) {
    try {
      const fullGroup = await client.invoke(new Api.channels.GetFullChannel({ channel: group }));
      const groupLink = await client.invoke(new Api.messages.ExportChatInvite({ peer: group }));

      extractedData.push({
        group_name: group.title,
        group_id: group.id.toString(),
        group_url: groupLink.link || 'N/A',
        description: fullGroup.fullChat.about || 'N/A',
        participant_count: group.participantsCount || 'Unknown',
        creation_date: fullGroup.fullChat.date || 'Unknown',
        admin_rights: fullGroup.fullChat.adminRights || 'N/A',
        banned_rights: fullGroup.fullChat.bannedRights || 'N/A',
      });
    } catch (error) {
      console.error('Error fetching group details:', error);
      // Handle specific errors here if needed
    }
  }

  return {
    data: extractedData,
    totalCount: dialogs.length,
    hasMore: dialogs.length > page * pageSize
  };
}

async function extractContacts(client, page, pageSize) {
  const contacts = await client.getContacts();
  const startIndex = (page - 1) * pageSize;
  const selectedContacts = contacts.slice(startIndex, startIndex + pageSize);
  const extractedData = [];

  for (const contact of selectedContacts) {
    try {
      const fullContact = await client.invoke(new Api.users.GetFullUser({ id: contact }));
      extractedData.push({
        id: contact.id.toString(),
        first_name: contact.firstName,
        last_name: contact.lastName,
        username: contact.username,
        phone_number: contact.phone,
        bio: fullContact.about || 'N/A',
        profile_photo_url: fullContact.profilePhoto?.photoId || 'N/A',
        online_status: contact.status || 'Unknown',
        is_bot: contact.bot || false,
      });
    } catch (error) {
      console.error('Error fetching contact details:', error);
      // Handle specific errors here if needed
    }
  }

  return {
    data: extractedData,
    totalCount: contacts.length,
    hasMore: contacts.length > page * pageSize
  };
}