import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVITY_COOKIE,
  readActivitySecret,
  readBackfillAuthenticatedAt,
  verifyActivityCookie,
  withinFreshSignIn,
} from "@/lib/auth/activity-cookie";
import { writeActivityCookie } from "@/lib/auth/activity-store";
import { getAuthServer } from "@/lib/auth/server";
import { isStrictSiteOrigin } from "@/lib/auth/site-origin";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" } as const;

function text(body: string, status: number, extra?: HeadersInit) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...PRIVATE_HEADERS, ...extra },
  });
}

function forbidden() {
  return text("Forbidden", 403);
}

function unauthorized() {
  return text("Unauthorized", 401);
}

function methodNotAllowed() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST", ...PRIVATE_HEADERS } });
}

/** 非 POST 不读取会话，也不写活动 Cookie。 */
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

/**
 * 已登录用户上报一次真实活动。
 * Origin 必须等于本次请求的站点 origin，否则 403。
 * 未登录返回 401，并且不写 Cookie。
 * 已有 Cookie 验不过时不把它当成有效活动。只有没有有效 Cookie，并且认证时间仍在两分钟窗口内，才补写新 Cookie。
 * 认证时间优先用访问令牌里的 amr 时间戳。amr 没有可用时间戳时，才用 getUser() 返回的 last_sign_in_at。
 * 两者都由服务端读取，用服务器时钟比较。不用令牌的 iat 或 exp，避免刷新令牌把已经超时的会话补活。
 * last_sign_in_at 是账号级的：同一账号在别处重新登录，会给其他仍有效的会话打开这两分钟窗口。
 */
export async function POST(request: NextRequest) {
  if (!isStrictSiteOrigin(request)) return forbidden();

  const db = await getAuthServer();
  const result = await db.auth.getUser();
  const user = result.data?.user;
  if (result.error || !user) return unauthorized();

  const secret = readActivitySecret();
  if (!secret) return text("Activity tracking is unavailable", 503);

  const jar = await cookies();
  const existing = jar.get(ACTIVITY_COOKIE)?.value;
  const now = Date.now();
  if (!verifyActivityCookie(existing, user.id, now, secret).ok) {
    const claims = await db.auth.getClaims();
    const authenticatedAt = readBackfillAuthenticatedAt(claims?.data?.claims?.amr, user.last_sign_in_at, now);
    if (!withinFreshSignIn(authenticatedAt, now)) return unauthorized();
  }

  if (!(await writeActivityCookie(user.id, now))) return text("Activity tracking is unavailable", 503);
  return new NextResponse(null, { status: 204, headers: PRIVATE_HEADERS });
}
