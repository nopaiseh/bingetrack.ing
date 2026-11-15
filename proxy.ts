import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVITY_COOKIE,
  clearedActivityCookieOptions,
  skipsIdleEnforcement,
  verifyActivityCookie,
} from "@/lib/auth/activity-cookie";
import { isSupabaseAuthSessionCookie } from "@/lib/auth/session-cookie";
import { isMediaId } from "@/lib/functions/media-id";

const DETAIL_PATH = /^\/(?:movies|shows)\/([^/]+)/;
const SEASON_PATH = /^\/shows\/[^/]+\/seasons\/([^/]+)/;

/** 详情页和季页的 loading 会先以 200 开始流式输出，notFound() 无法再改状态码，非法 ID 会被当成正常页面写入 ISR 缓存；因此在渲染前直接返回 404。 */
function rejectMalformedDetail(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const id = pathname.match(DETAIL_PATH)?.[1];
  const seasonId = pathname.match(SEASON_PATH)?.[1];
  if ((id !== undefined && !isMediaId(id)) || (seasonId !== undefined && !isMediaId(seasonId))) {
    return new NextResponse("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return null;
}

/**
 * 确认页是 page，验证是 /auth/confirm/verify 的 POST。
 * 浏览器仍提交到 /auth/confirm；在刷新会话之前改写，避免跨站提交先碰到 getClaims。
 */
function rewriteConfirmPost(request: NextRequest): NextResponse | null {
  if (request.method !== "POST" || request.nextUrl.pathname !== "/auth/confirm") return null;
  const url = request.nextUrl.clone();
  url.pathname = "/auth/confirm/verify";
  const response = NextResponse.rewrite(url);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

/**
 * 清除 Supabase 会话和活动 Cookie，再回到首页。
 * 这里只把活动 Cookie 设为过期，不写入新的时间戳；令牌刷新产生的 Set-Cookie 也不会被带到这次重定向上。
 */
async function expireIdleSession(
  request: NextRequest,
  db: { auth: { signOut: (options: { scope: "local" }) => Promise<unknown> } },
) {
  try {
    await db.auth.signOut({ scope: "local" });
  } catch {
    // 网络失败时仍清掉浏览器里的会话 Cookie。
  }
  const redirect = NextResponse.redirect(new URL("/", request.url), 303);
  for (const cookie of request.cookies.getAll()) {
    if (!isSupabaseAuthSessionCookie(cookie.name)) continue;
    redirect.cookies.set(cookie.name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: true });
  }
  redirect.cookies.set(ACTIVITY_COOKIE, "", clearedActivityCookieOptions());
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

/** 拒绝非法节目或季 ID；只为认证及管理路径刷新会话，并在这些路径上核对空闲期限。公开页面保持原有 CDN 缓存行为。 */
export async function proxy(request: NextRequest) {
  const rejected = rejectMalformedDetail(request);
  if (rejected) return rejected;

  const confirmPost = rewriteConfirmPost(request);
  if (confirmPost) return confirmPost;

  let response = NextResponse.next({ request });
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      /** 把请求 Cookie 提供给 Supabase。 */
      getAll: () => request.cookies.getAll(),
      /** 将刷新后的 Cookie 同时写入下游请求与浏览器响应。活动 Cookie 不在这里写。 */
      setAll(values) {
        const forwarded = values.filter((cookie) => cookie.name !== ACTIVITY_COOKIE);
        for (const { name, value } of forwarded) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of forwarded) response.cookies.set(name, value, options);
      },
    },
  });
  const claims = await db.auth.getClaims();
  const userId = claims?.data?.claims?.sub;
  if (typeof userId === "string" && userId && !skipsIdleEnforcement(request.method, request.nextUrl.pathname)) {
    const verdict = verifyActivityCookie(request.cookies.get(ACTIVITY_COOKIE)?.value, userId, Date.now());
    if (!verdict.ok) return expireIdleSession(request, db);
  }
  response.headers.set("Cache-Control", "private, no-store");
  if (request.nextUrl.pathname === "/auth/confirm") response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

// 详情路由只匹配不是 UUID 的节目或季 ID。合法详情页不经过 proxy，继续直接命中 ISR 缓存；matcher 须为静态字面量，不能引用常量。
export const config = {
  matcher: [
    "/manage/:path*",
    "/settings/:path*",
    "/auth/:path*",
    "/movies/:id((?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:/|$))[^/]+)/:rest*",
    "/shows/:id((?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:/|$))[^/]+)/:rest*",
    "/shows/:id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/seasons/:seasonId((?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:/|$))[^/]+)/:rest*",
  ],
};
