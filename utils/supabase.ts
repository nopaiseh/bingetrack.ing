import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseServerClient: SupabaseClient | null = null;

function getSupabaseServerUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be defined for server Supabase access.');
  }
  return supabaseUrl;
}

function getSupabaseServiceKey() {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be defined for server Supabase access.');
  }
  return supabaseServiceKey;
}

export function getSupabaseServer(): SupabaseClient {
  if (!supabaseServerClient) {
    supabaseServerClient = createClient(
      getSupabaseServerUrl(),
      getSupabaseServiceKey(),
    );
  }
  return supabaseServerClient;
}