import { createClient } from '@supabase/supabase-js';

/**
 * @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient
 */

// Read the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** @type {SupabaseClient | null} */
let supabase = null; // Initialize with null

try {
  if (!supabaseUrl) {
    throw new Error('Missing Supabase URL environment variable (NEXT_PUBLIC_SUPABASE_URL)');
  }
  if (!supabaseAnonKey) {
    throw new Error('Missing Supabase Anon Key environment variable (NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  // Create a supabase client instance
  supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Log successful client creation only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Supabase client initialized successfully.');
  }
} catch (error) {
  console.error('Error initializing Supabase client:', /** @type {Error} */ (error).message);
  // supabase remains null if initialization fails
}

export { supabase };
