import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { supabase } from '../../../lib/supabase';
import { Api, FloodWaitError } from 'telegram';
import { generateCSV } from '../../../lib/csvUtils';
import { checkRateLimit, handleTelegramError, handleSupabaseError } from '../../../lib/apiUtils';

export async function POST(req) {
  console.log("Received fetch-data request");
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: `Method ${req.method} Not Allowed` }), {
      status: 405,
      headers: { 'Allow': ['POST'], 'Content-Type': 'application/json' }
    });
  }

  try {
    checkRateLimit();

    const { apiId, apiHash, phoneNumber, extractType, page = 1, pageSize = 50, userId } = await req.json();
    if (!apiId || !apiHash || !phoneNumber || !extractType || !userId) {
      throw new Error('Missing required parameters');
    }

    const client = new TelegramClient(new StringSession(''), parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    let extractedData, totalCount, hasMore;
    if (extractType === 'groups') {
      ({ data: extractedData, totalCount, hasMore } = await extractGroups(client, page, pageSize));
    } else if (extractType === 'contacts') {
      ({ data: extractedData, totalCount, hasMore } = await extractContacts(client, page, pageSize));
    }

    await client.disconnect();

    await storeDataInSupabase(extractType, extractedData, userId);

    const csv = generateCSV(extractedData, getFields(extractType));
    const csvUrl = await storeCSVInSupabase(csv, extractType);

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
      await handleTelegramError(error);
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
        is_bot: contact.isBot || false,
      });
    } catch (error) {
      await handleTelegramError(error);
    }
  }

  return {
    data: extractedData,
    totalCount: contacts.length,
    hasMore: contacts.length > page * pageSize
  };
}

async function storeDataInSupabase(extractType, data, userId) {
  try {
    const { error } = await supabase.from(extractType).upsert(
      data.map(item => ({ ...item, owner_id: userId })),
      { onConflict: ['owner_id', extractType === 'groups' ? 'group_id' : 'id'] }
    );
    if (error) throw error;
  } catch (error) {
    handleSupabaseError(error);
  }
}

async function storeCSVInSupabase(csv, extractType) {
  const fileName = `${extractType}_${Date.now()}.csv`;
  try {
    const { data, error } = await supabase.storage
      .from('csv-exports')
      .upload(fileName, csv, { contentType: 'text/csv' });
    if (error) throw error;

    const { publicURL, error: urlError } = supabase.storage
      .from('csv-exports')
      .getPublicUrl(fileName);
    if (urlError) throw urlError;

    return publicURL;
  } catch (error) {
    handleSupabaseError(error);
  }
}

function getFields(extractType) {
  return extractType === 'groups'
    ? ['group_name', 'group_id', 'group_url', 'description', 'participant_count', 'creation_date', 'admin_rights', 'banned_rights']
    : ['id', 'first_name', 'last_name', 'username', 'phone_number', 'bio', 'profile_photo_url', 'online_status', 'is_bot'];
}