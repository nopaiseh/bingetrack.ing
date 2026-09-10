import { NextResponse } from "next/server";
import { getAuthServer } from "@/lib/auth/server";

/** 清理当前浏览器会话；网络失败时仍清除本地 Cookie，避免空闲会话继续使用。 */
export async function GET() {
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
