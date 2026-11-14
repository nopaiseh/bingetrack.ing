import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getAuthServer } from "@/lib/auth/server";

/** 运维密钥或 NEXT_PUBLIC_SUPABASE_URL 缺失。 */
type MissingConfig = { ok: false; reason: "missing_config" };

/** generateLink 没有返回可用的 hashed_token。 */
type GenerateFailed = { ok: false; reason: "generate_failed"; message: string };

/** verifyOtp 拒绝了一次性凭证。 */
type VerifyFailed = { ok: false; reason: "verify_failed"; message: string };

export type AdminMagicLinkResult =
  | { ok: true; hashedToken: string }
  | MissingConfig
  | GenerateFailed;

export type AdminSessionResult = { ok: true } | MissingConfig | GenerateFailed | VerifyFailed;

/**
 * 读取运维密钥。已设置的 SUPABASE_SECRET_KEY 优先，否则用 SUPABASE_SERVICE_ROLE_KEY。
 * 只含空白的值视为未设置。
 */
function readServiceRoleKey() {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

/** 用运维密钥创建 Admin 客户端。不持久化、不刷新会话。配置不齐时返回 null。 */
function createServiceRoleClient() {
  const secret = readServiceRoleKey();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !supabaseUrl) return null;
  return createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 为指定邮箱生成一次性 magic link，只返回 hashed_token，不发送邮件。
 * 调用方决定把 token 放进确认链接还是当前请求的 Cookie 会话。
 */
export async function generateAdminMagicLink(email: string): Promise<AdminMagicLinkResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "missing_config" };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashedToken = data.properties?.hashed_token;
  if (error || !hashedToken) {
    return {
      ok: false,
      reason: "generate_failed",
      message: error?.message || "无法生成凭据",
    };
  }

  return { ok: true, hashedToken };
}

/**
 * 生成 magic link 后，在当前请求的 Cookie 客户端上 verifyOtp，签发站长会话。
 * 邮箱会先 trim；空白视为配置缺失，不会调用 Supabase。
 * 调用方要先确认这次登录是否被允许。
 */
export async function createAdminSession(email: string | undefined): Promise<AdminSessionResult> {
  const normalized = email?.trim();
  if (!normalized) return { ok: false, reason: "missing_config" };

  const link = await generateAdminMagicLink(normalized);
  if (!link.ok) return link;

  const db = await getAuthServer();
  const { error } = await db.auth.verifyOtp({
    token_hash: link.hashedToken,
    type: "magiclink",
  });
  if (error) return { ok: false, reason: "verify_failed", message: error.message };
  return { ok: true };
}
