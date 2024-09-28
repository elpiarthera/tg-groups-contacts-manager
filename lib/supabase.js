import { createClient } from '@supabase/supabase-js';

// Read the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

// Log the values of the environment variables
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey);

// Create a Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseKey);
