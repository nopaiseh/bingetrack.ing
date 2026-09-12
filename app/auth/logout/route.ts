import { NextResponse } from "next/server";
import { getAuthServer } from "@/lib/auth/server";

/** 仅接受 POST 请求清理浏览器会话，避免 GET 链接预抓取或跨站图片触发登出。 */
export async function POST() {
  const db = await getAuthServer();
  const { error } = await db.auth.signOut({ scope: "local" });
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
