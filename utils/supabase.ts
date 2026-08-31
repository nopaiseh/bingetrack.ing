import "server-only";
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseServerClient: SupabaseClient | null = null;
let supabasePublicServerClient: SupabaseClient | null = null;

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

export function getSupabasePublicServer(): SupabaseClient {
  if (!supabasePublicServerClient) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined for public server Supabase access.");
    }
    supabasePublicServerClient = createClient(getSupabaseServerUrl(), anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabasePublicServerClient;
}
