import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseBrowserClient: SupabaseClient | null = null;

/** 读取浏览器使用的 Supabase URL，未配置时立即抛错。 */
function getSupabaseBrowserUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be defined for browser Supabase access.');
  }
  return supabaseUrl;
}

/** 读取浏览器使用的公开 Supabase 密钥，未配置时立即抛错。 */
function getSupabaseAnonKey() {
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined for browser Supabase access.');
  }
  return supabaseAnonKey;
}

// 首次调用时创建浏览器客户端，后续调用复用实例。
export function getSupabaseBrowser(): SupabaseClient {
  if (!supabaseBrowserClient) {
    supabaseBrowserClient = createClient(
      getSupabaseBrowserUrl(),
      getSupabaseAnonKey(),
    );
  }
  return supabaseBrowserClient;
}
