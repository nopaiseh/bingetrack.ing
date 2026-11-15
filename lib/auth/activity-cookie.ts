import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { IDLE_TIMEOUT } from "@/lib/auth/idle";

/** HttpOnly 最近活动 Cookie。只由签发登录或 POST /auth/activity 写入，proxy 只读。 */
export const ACTIVITY_COOKIE = "bt-activity";

/**
 * 刚完成登录、Cookie 尚未写入时允许补记的窗口。
 * 只看 Auth 用户的 last_sign_in_at，不用 access token 的 iat，因此刷新令牌不会重新打开这个窗口。
 */
export const FRESH_SIGN_IN_MS = 2 * 60 * 1000;

const FUTURE_SKEW_MS = 60 * 1000;
const TOKEN = /^v1\.([^.]+)\.(\d+)\.([A-Za-z0-9_-]+)$/;

export type ActivityVerdict =
  | { ok: true; at: number }
  | { ok: false; reason: "missing" | "malformed" | "signature" | "mismatch" | "expired" | "unconfigured" };

/**
 * 复用已有的服务端密钥给活动时间签名，不新增环境变量。
 * 已设置的 SUPABASE_SECRET_KEY 优先，否则用生产环境已有的 SUPABASE_SERVICE_ROLE_KEY。
 * 两者都缺失时返回 null，调用方必须拒绝签发并拒绝无法核验的会话。
 */
export function readActivitySecret() {
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return secret || null;
}

export function activityCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: IDLE_TIMEOUT / 1000,
  };
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** 把用户 id 和毫秒时间戳绑进 HMAC，换账号或改时间都会使签名失效。 */
export function signActivityCookie(userId: string, at: number, secret: string) {
  if (!userId || userId.includes(".") || !Number.isSafeInteger(at)) {
    throw new Error("无法签名活动 Cookie");
  }
  const payload = `v1.${userId}.${at}`;
  return `${payload}.${signPayload(payload, secret)}`;
}

/** 校验签名、用户绑定和 30 分钟期限。密钥缺失时一律视为不可信。 */
export function verifyActivityCookie(
  value: string | undefined,
  userId: string,
  now = Date.now(),
  secret = readActivitySecret(),
): ActivityVerdict {
  if (!secret) return { ok: false, reason: "unconfigured" };
  if (!value) return { ok: false, reason: "missing" };
  const match = TOKEN.exec(value);
  if (!match) return { ok: false, reason: "malformed" };
  const [, subject, stamp, signature] = match;
  const payload = `v1.${subject}.${stamp}`;
  if (!signaturesMatch(signature, signPayload(payload, secret))) return { ok: false, reason: "signature" };
  if (subject !== userId) return { ok: false, reason: "mismatch" };
  const at = Number(stamp);
  if (!Number.isSafeInteger(at) || at > now + FUTURE_SKEW_MS) return { ok: false, reason: "malformed" };
  if (now - at >= IDLE_TIMEOUT) return { ok: false, reason: "expired" };
  return { ok: true, at };
}

/**
 * 这些请求负责建立会话并写下第一枚活动 Cookie。
 * proxy 若在这里因「还没有 Cookie」而登出，魔法链接和 Passkey 刚登录就会被立刻踢出。
 */
export function skipsIdleEnforcement(method: string, pathname: string) {
  if (method === "POST" && pathname === "/auth/activity") return true;
  if (method === "POST" && (pathname === "/auth/confirm" || pathname === "/auth/confirm/verify")) return true;
  if (method === "GET" && pathname === "/auth/dev-login") return true;
  if (method === "POST" && pathname === "/auth/agent-login") return true;
  return false;
}
