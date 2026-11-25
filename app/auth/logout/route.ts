import { NextResponse, type NextRequest } from "next/server";
import { clearActivityCookie } from "@/lib/auth/activity-store";
import { isSameOrigin } from "@/lib/auth/confirm-link";
import { getAuthServer } from "@/lib/auth/server";

/** 仅接受 POST 请求清理浏览器会话，避免 GET 链接预抓取或跨站图片触发登出。 */
export async function POST(request: NextRequest) {
  // 与确认提交一样走 isSameOrigin：表单 POST 需兼容 Host／站点规范地址与 nextUrl 不一致的情况。
  if (!isSameOrigin(request)) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }

  const db = await getAuthServer();
  const { error } = await db.auth.signOut({ scope: "local" });
  await clearActivityCookie();
  if (error) {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    for (const cookie of jar.getAll()) {
      if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) jar.delete(cookie.name);
    }
  }
  return new NextResponse(null, { status: 303, headers: { Location: "/", "Cache-Control": "private, no-store" } });
}

/** GET 请求仅作安全重定向，不改变会话状态，防范 Logout CSRF。 */
export async function GET() {
  return new NextResponse(null, { status: 303, headers: { Location: "/", "Cache-Control": "private, no-store" } });
}
