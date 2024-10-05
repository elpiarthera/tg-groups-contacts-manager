import { FloodWaitError, errors } from 'telegram';
import { NextResponse } from 'next/server';

const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_BACKOFF_TIME = 60000; // 1 minute

let requestCount = 0;
let lastRequestTime = Date.now();
let backoffTime = 2000; // Start with 2 seconds

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

  if (error instanceof FloodWaitError) {
    console.warn(`Rate limit hit! Waiting for ${error.seconds} seconds...`);
    await new Promise(resolve => setTimeout(resolve, error.seconds * 1000));
    backoffTime = Math.min(error.seconds * 1000, MAX_BACKOFF_TIME);
    return NextResponse.json({
      success: false,
      error: {
        code: 429,
        message: `Rate limit exceeded. Please try again after ${error.seconds} seconds.`
      }
    }, { status: 429 });
  } 
  else if (error instanceof errors.PhoneNumberInvalidError) {
    return NextResponse.json({
      success: false,
      error: {
        code: 400,
        message: 'Invalid phone number. Please check and try again.'
      }
    }, { status: 400 });
  }
  else if (error instanceof errors.PhoneCodeInvalidError) {
    return NextResponse.json({
      success: false,
      error: {
        code: 400,
        message: 'Invalid verification code. Please try again.'
      }
    }, { status: 400 });
  }
  else if (error instanceof errors.SessionPasswordNeededError) {
    return NextResponse.json({
      success: false,
      error: {
        code: 400,
        message: 'Two-factor authentication is enabled. Please disable it temporarily to use this service.'
      }
    }, { status: 400 });
  }
  else if (error instanceof errors.AuthKeyUnregisteredError) {
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
