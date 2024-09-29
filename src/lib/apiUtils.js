import { FloodWaitError } from 'telegram';

const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_BACKOFF_TIME = 60000;

let requestCount = 0;
let lastRequestTime = Date.now();
let backoffTime = 2000;

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
  if (error instanceof FloodWaitError) {
    console.warn(`Rate limit hit! Waiting for ${error.seconds} seconds...`);
    await new Promise(resolve => setTimeout(resolve, error.seconds * 1000));
    backoffTime = Math.min(error.seconds * 1000, MAX_BACKOFF_TIME);
  } else {
    console.error('Telegram API error:', error);
    throw error;
  }
}

export function handleSupabaseError(error) {
  console.error('Supabase error:', error);
  throw new Error('Database operation failed');
}
