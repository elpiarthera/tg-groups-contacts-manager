// lib/supabase.js

import { createClient } from '@supabase/supabase-js';

// Reading the Supabase URL and Key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

// Creating a Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseKey);
