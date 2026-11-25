import "server-only";
import { createHmac, hkdfSync, timingSafeEqual, type BinaryLike } from "node:crypto";
import { IDLE_TIMEOUT } from "@/lib/auth/idle";

/** HttpOnly 最近活动 Cookie。只由签发登录或 POST /auth/activity 写入，proxy 只读。 */
export const ACTIVITY_COOKIE = "bt-activity";

/**
 * 刚完成本次会话认证、Cookie 尚未写入时允许补记的窗口。
 * 时间来自访问令牌里的 amr（本次认证方法的时间），不是用户级的 last_sign_in_at，也不是令牌的 iat。
 * 刷新 access token 不会写入新的 amr，因此不能重新打开这个窗口。比较只用服务端时钟。
 */
export const FRESH_SIGN_IN_MS = 2 * 60 * 1000;

/** HKDF info。把服务端密钥派生出只用于空闲 Cookie 的子密钥，避免直接拿原始密钥做 HMAC。 */
export const ACTIVITY_COOKIE_HKDF_INFO = "bingetrack-idle-cookie-v1";

const FUTURE_SKEW_MS = 60 * 1000;
const TOKEN = /^v1\.([^.]+)\.(\d+)\.([A-Za-z0-9_-]+)$/;

export type ActivityVerdict =
  | { ok: true; at: number }
  | { ok: false; reason: "missing" | "malformed" | "signature" | "mismatch" | "expired" | "unconfigured" };

/**
 * 从已有的服务端密钥派生空闲 Cookie 的 HMAC 子密钥，不新增环境变量。
 * 已设置的 SUPABASE_SECRET_KEY 优先，否则用生产环境已有的 SUPABASE_SERVICE_ROLE_KEY。
 * 两者都缺失时返回 null，调用方必须拒绝签发并拒绝无法核验的会话。
 * 返回值是 HKDF-SHA256 的 32 字节子密钥，不是原始密钥本身。
 */
export function readActivitySecret() {
  const ikm = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!ikm) return null;
  return Buffer.from(hkdfSync("sha256", ikm, Buffer.alloc(0), ACTIVITY_COOKIE_HKDF_INFO, 32));
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

/** 结束会话时用同一套属性把活动 Cookie 设为立即过期。只清掉，不续期。 */
export function clearedActivityCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

function signPayload(payload: string, secret: BinaryLike) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** 把用户 id 和毫秒时间戳绑进 HMAC，换账号或改时间都会使签名失效。secret 应是派生后的子密钥。 */
export function signActivityCookie(userId: string, at: number, secret: BinaryLike) {
  if (!userId || userId.includes(".") || !Number.isSafeInteger(at)) {
    throw new Error("无法签名活动 Cookie");
  }
  const payload = `v1.${userId}.${at}`;
  return `${payload}.${signPayload(payload, secret)}`;
}

const AMR_METHOD = /^[a-z0-9/_-]{1,40}$/i;

/**
 * 把 amr 里的一个时间戳换成毫秒。
 * GoTrue 的 Passkey 登录写成 `{ method: "passkey", timestamp: <unix 秒> }`。
 * 数字字符串按同样的秒处理。已经是毫秒的大整数（≥ 1e12）不再乘 1000。
 * ISO 时间字符串也认。没有可解析的 timestamp 时返回 null。不读取 iat 或 exp。
 */
function amrTimestampMs(raw: unknown) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw < 0) return null;
    return raw >= 1e12 ? raw : raw * 1000;
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    if (numeric < 0) return null;
    return numeric >= 1e12 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 从已验证的访问令牌 amr 里取本次会话的认证时间（毫秒）。
 * 只有方法名、没有可解析 timestamp 的条目不算认证时间。未来时间视为不可信。不读取 iat。
 */
export function readSessionAuthenticatedAt(amr: unknown, now = Date.now()) {
  if (!Array.isArray(amr)) return null;
  let latest = -1;
  for (const entry of amr) {
    if (!entry || typeof entry !== "object" || !("timestamp" in entry)) continue;
    const at = amrTimestampMs((entry as { timestamp: unknown }).timestamp);
    if (at === null) continue;
    latest = Math.max(latest, at);
  }
  if (latest < 0) return null;
  if (latest > now + FUTURE_SKEW_MS) return null;
  return latest;
}

/** 日志用的 amr 形状：只有方法名和有没有时间戳。不含时间、用户、邮箱或令牌。 */
export function describeActivityAmr(amr: unknown) {
  if (!Array.isArray(amr)) return amr == null ? "missing" : typeof amr;
  if (amr.length === 0) return "empty";
  return amr
    .map((entry) => {
      if (typeof entry === "string") return `string:${AMR_METHOD.test(entry) ? entry : "other"}`;
      if (!entry || typeof entry !== "object") return "other";
      const methodRaw = "method" in entry && typeof entry.method === "string" ? entry.method : "";
      const method = AMR_METHOD.test(methodRaw) ? methodRaw : "object";
      const hasTimestamp = "timestamp" in entry && amrTimestampMs((entry as { timestamp: unknown }).timestamp) !== null;
      return `${method}:${hasTimestamp ? "ts" : "no-ts"}`;
    })
    .join(",");
}

/**
 * 补记窗口用的认证时间。有可用的 amr 时间戳时只用它，即使它已经超出窗口，也不改用 last_sign_in_at。
 * 只有 amr 没有可用时间戳时，才用 Auth 服务器返回的 last_sign_in_at。绝不使用令牌的 iat 或 exp。
 */
export function readBackfillAuthenticatedAt(amr: unknown, lastSignInAt: string | null | undefined, now = Date.now()) {
  const fromAmr = readSessionAuthenticatedAt(amr, now);
  if (fromAmr !== null) return fromAmr;
  const parsed = Date.parse(lastSignInAt ?? "");
  if (!Number.isFinite(parsed) || parsed > now + FUTURE_SKEW_MS) return null;
  return parsed;
}

/** 只有认证时间落在补记窗口内，才允许在没有有效活动 Cookie 时补写。 */
export function withinFreshSignIn(authenticatedAt: number | null, now = Date.now()) {
  if (authenticatedAt === null) return false;
  return authenticatedAt <= now + FUTURE_SKEW_MS && now - authenticatedAt <= FRESH_SIGN_IN_MS;
}

/** 校验签名、用户绑定和 30 分钟期限。密钥缺失时一律视为不可信。 */
export function verifyActivityCookie(
  value: string | undefined,
  userId: string,
  now = Date.now(),
  secret: BinaryLike | null = readActivitySecret(),
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
  // 登出本身就是结束会话；若先被空闲检查改写响应，表单 POST 到不了 route handler。
  if (method === "POST" && pathname === "/auth/logout") return true;
  // 打开一次性链接时如果先被空闲检查重定向，查询串会丢，确认页无法提交。
  if (method === "GET" && pathname === "/auth/confirm") return true;
  if (method === "GET" && pathname === "/auth/dev-login") return true;
  if (method === "POST" && pathname === "/auth/agent-login") return true;
  return false;
}
