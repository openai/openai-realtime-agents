import { createClient } from '@supabase/supabase-js';

// Note: Only use this client in API routes or client components marked with "use client"
// For server components, create a separate server-side Supabase client

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase; 