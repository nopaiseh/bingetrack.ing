import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthServer } from "@/lib/auth/server";

/** 使用 SHA-256 定长摘要做常量时间比对，避免时序侧信道泄露口令内容或长度。 */
function verifyAgentToken(candidate: string, expected: string): boolean {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

/** 从 Authorization 头或查询参数提取 Agent 登录口令。 */
function extractTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const queryToken = request.nextUrl.searchParams.get("token")?.trim();
  return queryToken || null;
}

/** 解析并校验站内回跳地址，拒绝任何外部或协议相对路径。 */
function resolveSafeNext(next: string | null, origin: string): string {
  const resolved = next?.startsWith("/") ? new URL(next, origin) : null;
  return resolved?.origin === origin
    ? `${resolved.pathname}${resolved.search}${resolved.hash}`
    : "/manage";
}

/** 执行 Agent 令牌校验并签发站长会话 Cookie。 */
async function handleAgentLogin(
  request: NextRequest,
  token: string | null,
  nextParam: string | null,
) {
  const expectedToken = process.env.AGENT_LOGIN_TOKEN?.trim();
  if (!expectedToken) {
    return new NextResponse(null, { status: 404 });
  }

  if (!token || !verifyAgentToken(token, expectedToken)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  const email = process.env.OWNER_EMAIL?.trim();
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!email || !secret || !supabaseUrl) {
    return new NextResponse(
      "Agent 登录失败：请配置 OWNER_EMAIL 和 SUPABASE_SECRET_KEY",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const adminDb = createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await adminDb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data.properties?.hashed_token) {
    return new NextResponse(
      `Agent 登录失败：${error?.message || "无法生成凭据"}`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const db = await getAuthServer();
  const { error: verifyError } = await db.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError) {
    return new NextResponse(`Agent 登录验证失败：${verifyError.message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const target = resolveSafeNext(nextParam, request.nextUrl.origin);

  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: target,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/**
 * 供远程浏览器 Agent（如 Muse / Grok Bot）直接通过链接或请求头完成站长登录。
 * 未配置 AGENT_LOGIN_TOKEN 时返回 404。
 */
export async function GET(request: NextRequest) {
  const token = extractTokenFromRequest(request);
  const next = request.nextUrl.searchParams.get("next");
  return handleAgentLogin(request, token, next);
}

/** 支持通过 POST（表单、JSON 或 Authorization 头）提交口令登录，避免口令出现在 URL 中。 */
export async function POST(request: NextRequest) {
  let token = extractTokenFromRequest(request);
  let next = request.nextUrl.searchParams.get("next");

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | { token?: unknown; next?: unknown }
      | null;
    if (!token && typeof body?.token === "string") token = body.token.trim();
    if (!next && typeof body?.next === "string") next = body.next.trim();
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData().catch(() => null);
    const formToken = form?.get("token");
    const formNext = form?.get("next");
    if (!token && typeof formToken === "string") token = formToken.trim();
    if (!next && typeof formNext === "string") next = formNext.trim();
  }

  return handleAgentLogin(request, token, next);
}

