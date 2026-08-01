import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseBrowserClient: SupabaseClient | null = null;

function getSupabaseBrowserUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be defined for browser Supabase access.');
  }
  return supabaseUrl;
}

function getSupabaseAnonKey() {
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined for browser Supabase access.');
  }
  return supabaseAnonKey;
}

export function getSupabaseBrowser(): SupabaseClient {
  if (!supabaseBrowserClient) {
    supabaseBrowserClient = createClient(
      getSupabaseBrowserUrl(),
      getSupabaseAnonKey(),
    );
  }
  return supabaseBrowserClient;
}
