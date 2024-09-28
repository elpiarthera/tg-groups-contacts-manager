import { createClient } from '@supabase/supabase-js';

// Read the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

// Log the values of the environment variables
console.log('supabase URL:', supabaseUrl);
console.log('supabase Key:', supabaseKey);
console.log('Supabase client created:', supabase);
console.log("Supabase Config Loaded");


// Create a supabase client instance
export const supabase = createClient(supabaseUrl, supabaseKey);
