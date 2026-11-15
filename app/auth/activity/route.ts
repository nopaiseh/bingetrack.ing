import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVITY_COOKIE,
  readActivitySecret,
  readSessionAuthenticatedAt,
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
 * 已有 Cookie 验不过（过期、伪造、串号）时不接受它，只在本次会话的 amr 仍处于补记窗口内才另写一枚新 Cookie。
 * 窗口用服务端时钟比较访问令牌里的 amr，不用客户端传来的时间，也不用用户级 last_sign_in_at。
 * 因此已经闲置超时的旧会话不能靠删掉或改掉 Cookie 复活；刚用 Passkey 换过的新会话可以补上自己的 Cookie。
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
    const authenticatedAt = readSessionAuthenticatedAt(claims?.data?.claims?.amr, now);
    if (!withinFreshSignIn(authenticatedAt, now)) return unauthorized();
  }

  if (!(await writeActivityCookie(user.id, now))) return text("Activity tracking is unavailable", 503);
  return new NextResponse(null, { status: 204, headers: PRIVATE_HEADERS });
}
