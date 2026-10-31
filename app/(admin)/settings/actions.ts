"use server";

import { createClient } from "@supabase/supabase-js";
import { requireOwner } from "@/lib/auth/server";
import { SITE_URL } from "@/lib/site";

export type AgentLinkResult = { url?: string; error?: string };

/**
 * 为已通过 Passkey 认证的站长生成一条用完即焚的一次性登录链接，
 * 供 Muse / Grok Bot 等云端浏览器 Agent 直接打开并进入 /manage。
 */
export async function createAgentLoginLink(): Promise<AgentLinkResult> {
  // 身份校验放在 try 之外，保证未登录时的重定向正常抛出。
  const { user } = await requireOwner();
  const email = user.email?.trim() || process.env.OWNER_EMAIL?.trim();
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!secret || !supabaseUrl || !email) {
    return { error: "请先在服务端环境变量中配置 SUPABASE_SECRET_KEY。" };
  }

  try {
    const adminDb = createClient(supabaseUrl, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await adminDb.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !data.properties?.hashed_token) {
      return { error: "生成一次性登录链接失败，请检查 SUPABASE_SECRET_KEY 配置。" };
    }
    const origin = new URL(SITE_URL).origin;
    const link = new URL("/auth/confirm", origin);
    link.searchParams.set("token_hash", data.properties.hashed_token);
    link.searchParams.set("type", "magiclink");
    link.searchParams.set("next", "/manage");
    return { url: link.toString() };
  } catch {
    return { error: "生成一次性登录链接失败，请稍后重试。" };
  }
}

