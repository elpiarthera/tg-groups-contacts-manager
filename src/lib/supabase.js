import { createClient } from '@supabase/supabase-js';

// Read the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase;

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Create a supabase client instance
  supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Log successful client creation only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Supabase client created successfully');
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error.message);
  // You might want to set supabase to null or a mock client here
  supabase = null;
}

export { supabase };
