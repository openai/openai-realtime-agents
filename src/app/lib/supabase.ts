import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { type Database } from '../../database/database.types';

// Note: Only use this client in API routes or client components marked with "use client"
// For server components, create a separate server-side Supabase client

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
}

// For client components
let clientInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null;

export function getSupabaseClient() {
  if (clientInstance) return clientInstance;
  
  clientInstance = createClientComponentClient<Database>();
  return clientInstance;
}

// Export the singleton instance for client components
const supabase = getSupabaseClient();
export default supabase; 