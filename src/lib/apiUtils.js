import { FloodWaitError, errors } from 'telegram'; // Import errors from telegram for more specific error handling

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
    await new Promise(resolve => setTimeout(resolve, error.seconds * 1000)); // Wait for the duration specified by FloodWaitError
    backoffTime = Math.min(error.seconds * 1000, MAX_BACKOFF_TIME);
  } 
  else if (error instanceof errors.PhoneNumberInvalidError) { // Add specific handling for PhoneNumberInvalidError
    console.error('Invalid phone number error:', error);
    throw new Error('Invalid phone number. Please check and try again.');
  }
  else {
    console.error('Telegram API error:', error);
    throw error; // Re-throw any other errors to be handled elsewhere
  }
}

export function handleSupabaseError(error) {
  console.error('Supabase error:', error);
  throw new Error('Database operation failed');
}
