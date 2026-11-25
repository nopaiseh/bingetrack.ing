import { NextResponse, type NextRequest } from "next/server";
import { createAdminSession } from "@/lib/auth/admin-session";

/**
 * 仅用于本地开发环境的免密登录路由。
 * 生产环境严格禁用（返回 404），防止未授权访问。
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const session = await createAdminSession(process.env.OWNER_EMAIL);

  if (!session.ok) {
    const message =
      session.reason === "verify_failed"
        ? `开发登录验证失败：${session.message}`
        : session.reason === "generate_failed"
          ? `开发登录失败：${session.message}`
          : "开发登录失败：请在 .env.local 中配置 OWNER_EMAIL 和 SUPABASE_SECRET_KEY";
    return new NextResponse(message, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const next = request.nextUrl.searchParams.get("next");
  // 按浏览器的规则解析后再比较来源："//"、"/\\" 以及夹带制表符、换行的写法都会被解析成站外地址。
  // 畸形值（如 //[）会让 new URL 抛错，捕获后回落到默认目标，避免 500。
  let target = "/manage";
  if (next?.startsWith("/")) {
    try {
      const resolved = new URL(next, request.nextUrl.origin);
      if (resolved.origin === request.nextUrl.origin) {
        target = `${resolved.pathname}${resolved.search}${resolved.hash}`;
      }
    } catch {
      // 保持 /manage
    }
  }

  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: target,
      "Cache-Control": "private, no-store",
    },
  });
}
