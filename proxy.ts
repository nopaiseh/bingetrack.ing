import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** 只为认证及管理路径刷新会话，公开页面保持原有 CDN 缓存行为。 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /** 把请求 Cookie 提供给 Supabase。 */
        getAll: () => request.cookies.getAll(),
        /** 将刷新后的 Cookie 同时写入下游请求与浏览器响应。 */
        setAll(values) {
          for (const { name, value } of values) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of values) response.cookies.set(name, value, options);
        },
      },
    },
  );
  await db.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/manage/:path*", "/settings/:path*", "/auth/:path*"] };
