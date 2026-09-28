import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isMediaId } from "@/lib/functions/media-id";

const DETAIL_PATH = /^\/(?:movies|shows)\/([^/]+)/;

/** 详情路由的 loading 会让页面先以 200 开始流式输出，notFound() 无法再改状态码，非法 ID 会被当成正常页面写入 ISR 缓存；因此在渲染前直接返回 404。 */
function rejectMalformedDetail(request: NextRequest): NextResponse | null {
  const id = request.nextUrl.pathname.match(DETAIL_PATH)?.[1];
  if (id === undefined || isMediaId(id)) return null;
  return new NextResponse("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/** 拒绝非法详情 ID；只为认证及管理路径刷新会话，公开页面保持原有 CDN 缓存行为。 */
export async function proxy(request: NextRequest) {
  const rejected = rejectMalformedDetail(request);
  if (rejected) return rejected;

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

// 详情路由只匹配不是 UUID 的 ID，合法详情页不经过 proxy，继续直接命中 ISR 缓存；matcher 须为静态字面量，不能引用常量。
export const config = {
  matcher: [
    "/manage/:path*",
    "/settings/:path*",
    "/auth/:path*",
    "/movies/:id((?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:/|$))[^/]+)/:rest*",
    "/shows/:id((?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:/|$))[^/]+)/:rest*",
  ],
};
