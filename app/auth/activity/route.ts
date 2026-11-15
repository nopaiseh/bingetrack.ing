import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVITY_COOKIE,
  FRESH_SIGN_IN_MS,
  readActivitySecret,
  verifyActivityCookie,
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
 * 未登录返回 401，并且不写 Cookie。过期、伪造或属于其他用户的 Cookie 同样拒绝刷新。
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
  if (existing) {
    if (!verifyActivityCookie(existing, user.id, now, secret).ok) return unauthorized();
  } else {
    const signedInAt = Date.parse(user.last_sign_in_at ?? "");
    if (!Number.isFinite(signedInAt) || now - signedInAt > FRESH_SIGN_IN_MS) return unauthorized();
  }

  if (!(await writeActivityCookie(user.id, now))) return text("Activity tracking is unavailable", 503);
  return new NextResponse(null, { status: 204, headers: PRIVATE_HEADERS });
}
