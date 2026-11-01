import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthServer } from "@/lib/auth/server";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
} as const;

/**
 * 使用 SHA-256 定长摘要做常量时间比对，避免时序侧信道泄露口令内容或长度。
 * 摘要长度固定，因此不会因口令长度不同而让 timingSafeEqual 抛错。
 */
function verifyAgentToken(candidate: string, expected: string): boolean {
  const candidateDigest = createHash("sha256").update(candidate, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

/** 未配置或只有空白时视为关闭。生产环境不设置该变量，接口保持 404。 */
function expectedAgentToken(): string | null {
  const value = process.env.AGENT_LOGIN_TOKEN?.trim();
  return value ? value : null;
}

/** 查询参数名大小写不敏感；只判断是否出现，不读取口令值。 */
function hasTokenQueryParam(request: NextRequest): boolean {
  for (const key of request.nextUrl.searchParams.keys()) {
    if (key.toLowerCase() === "token") return true;
  }
  return false;
}

/** 只接受 Authorization: Bearer。不读取查询串、JSON 或表单中的口令。 */
function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization")?.trim();
  if (!header) return null;
  const match = /^Bearer\s+(\S.*)$/i.exec(header);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
}

/** 解析并校验站内回跳地址，拒绝任何外部或协议相对路径。 */
function resolveSafeNext(next: string | null, origin: string): string {
  const resolved = next?.startsWith("/") ? new URL(next, origin) : null;
  return resolved?.origin === origin
    ? `${resolved.pathname}${resolved.search}${resolved.hash}`
    : "/manage";
}

function notFound() {
  return new NextResponse(null, { status: 404, headers: PRIVATE_HEADERS });
}

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...PRIVATE_HEADERS,
    },
  });
}

function methodNotAllowed() {
  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "POST",
      ...PRIVATE_HEADERS,
    },
  });
}

function textError(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...PRIVATE_HEADERS,
    },
  });
}

/** 口令已通过校验后，用 service role 签发站长 Cookie 会话。 */
async function issueOwnerSession(request: NextRequest) {
  const email = process.env.OWNER_EMAIL?.trim();
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!email || !secret || !supabaseUrl) {
    return textError("Agent 登录失败：请配置 OWNER_EMAIL 和 SUPABASE_SECRET_KEY", 500);
  }

  const adminDb = createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await adminDb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data.properties?.hashed_token) {
    return textError(`Agent 登录失败：${error?.message || "无法生成凭据"}`, 500);
  }

  const db = await getAuthServer();
  const { error: verifyError } = await db.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError) {
    return textError(`Agent 登录验证失败：${verifyError.message}`, 500);
  }

  const target = resolveSafeNext(request.nextUrl.searchParams.get("next"), request.nextUrl.origin);

  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: target,
      ...PRIVATE_HEADERS,
    },
  });
}

/**
 * 供远程浏览器 Agent 登录的入口。
 * 未配置 AGENT_LOGIN_TOKEN 时返回 404。
 * 口令只能放在 POST 的 Authorization: Bearer 中；GET 与 ?token= 都不登录。
 */
export async function GET(request: NextRequest) {
  // 读取本次请求的路径，避免构建期把响应冻成静态 404；不读取 token 的值。
  const pathname = request.nextUrl.pathname;
  if (!expectedAgentToken() || !pathname.startsWith("/auth/agent-login")) {
    return notFound();
  }
  return methodNotAllowed();
}

/** 仅通过 Authorization: Bearer 提交口令。查询串中的 token 一律拒绝。 */
export async function POST(request: NextRequest) {
  const expected = expectedAgentToken();
  if (!expected) return notFound();

  // 查询串会进入浏览器历史、访问日志和 Referer。出现 token 时直接拒绝，
  // 即使同时带了正确的 Bearer 也不签发会话。
  if (hasTokenQueryParam(request)) return unauthorized();

  const bearer = extractBearerToken(request);
  // 缺失口令也走同一比对，避免用“是否执行比较”区分空口令与错误口令。
  const matches = verifyAgentToken(bearer ?? "", expected);
  if (!bearer || !matches) return unauthorized();

  return issueOwnerSession(request);
}
