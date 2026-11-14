"use server";

import { generateAdminMagicLink } from "@/lib/auth/admin-session";
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
  if (!email) {
    return { error: "请先在服务端环境变量中配置 SUPABASE_SECRET_KEY。" };
  }

  try {
    const link = await generateAdminMagicLink(email);
    if (!link.ok) {
      return {
        error:
          link.reason === "missing_config"
            ? "请先在服务端环境变量中配置 SUPABASE_SECRET_KEY。"
            : "生成一次性登录链接失败，请检查 SUPABASE_SECRET_KEY 配置。",
      };
    }
    const origin = new URL(SITE_URL).origin;
    const confirmUrl = new URL("/auth/confirm", origin);
    confirmUrl.searchParams.set("token_hash", link.hashedToken);
    confirmUrl.searchParams.set("type", "magiclink");
    confirmUrl.searchParams.set("next", "/manage");
    return { url: confirmUrl.toString() };
  } catch {
    return { error: "生成一次性登录链接失败，请稍后重试。" };
  }
}

