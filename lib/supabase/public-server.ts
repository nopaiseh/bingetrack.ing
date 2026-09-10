import "server-only";
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabasePublicServerClient: SupabaseClient | null = null;

/** 读取服务端公开查询使用的 Supabase URL，未配置时立即抛错。 */
function getSupabaseServerUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be defined for server Supabase access.');
  }
  return supabaseUrl;
}

// 复用公开密钥客户端并关闭会话持久化、刷新和 URL 会话检测，用于服务端公开数据查询。
export function getSupabasePublicServer(): SupabaseClient {
  if (!supabasePublicServerClient) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined for public server Supabase access.");
    }
    supabasePublicServerClient = createClient(getSupabaseServerUrl(), anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return supabasePublicServerClient;
}
