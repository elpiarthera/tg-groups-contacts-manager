import { createClient } from '@supabase/supabase-js';

// Read the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check for missing environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  throw new Error('Missing Supabase environment variables');
}

// Create a supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Log successful client creation
console.log('Supabase client created successfully');

// Remove or comment out these console.log statements
// console.log('Supabase client created:', supabase);
// console.log("Supabase Config Loaded");