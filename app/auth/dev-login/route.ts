import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthServer } from "@/lib/auth/server";

/**
 * 仅用于本地开发环境的免密登录路由。
 * 生产环境严格禁用（返回 404），防止未授权访问。
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const email = process.env.OWNER_EMAIL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!email || !secret || !supabaseUrl) {
    return new NextResponse("开发登录失败：请在 .env.local 中配置 OWNER_EMAIL 和 SUPABASE_SECRET_KEY", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const adminDb = createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await adminDb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data.properties?.hashed_token) {
    return new NextResponse(`开发登录失败：${error?.message || "无法生成凭据"}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const db = await getAuthServer();
  const { error: verifyError } = await db.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError) {
    return new NextResponse(`开发登录验证失败：${verifyError.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const next = request.nextUrl.searchParams.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/manage";

  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: target,
      "Cache-Control": "private, no-store",
    },
  });
}

