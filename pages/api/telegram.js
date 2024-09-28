// pages/api/telegram.js
import { Bot } from "grammy"; // Import grammY for Telegram API

// Initialize the bot with your bot token (from BotFather)
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { extractType } = req.body; // Receive the type (groups or contacts) from the frontend
    
    try {
      // Depending on what you're extracting
      if (extractType === 'groups') {
        const groups = await fetchTelegramGroups();
        return res.status(200).json({ groups });
      } else if (extractType === 'contacts') {
        const contacts = await fetchTelegramContacts();
        return res.status(200).json({ contacts });
      } else {
        return res.status(400).json({ error: 'Invalid extract type' });
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  } else {
    // Handle other HTTP methods
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// Function to fetch Telegram groups (this would be similar to your extract_groups function in Python)
async function fetchTelegramGroups() {
  const updates = await bot.api.getUpdates(); // Example call to get updates, you can customize this
  const groups = updates.filter(update => update.message && update.message.chat.type === 'group');
  
  return groups.map(group => ({
    id: group.message.chat.id,
    name: group.message.chat.title,
    members_count: group.message.chat.members_count || 'N/A', // Use members_count if available
    invite_link: group.message.chat.invite_link || 'N/A'
  }));
}

// Function to fetch Telegram contacts (similar to extract_contacts)
async function fetchTelegramContacts() {
  // Use bot.api to get contacts, adjust based on Telegram API
  const updates = await bot.api.getUpdates();
  const contacts = updates.filter(update => update.message && update.message.contact);

  return contacts.map(contact => ({
    name: `${contact.message.contact.first_name} ${contact.message.contact.last_name || ''}`,
    phone: contact.message.contact.phone_number,
    user_id: contact.message.contact.user_id
  }));
}