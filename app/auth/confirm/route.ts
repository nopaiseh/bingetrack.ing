import { NextResponse, type NextRequest } from "next/server";
import { getAuthServer } from "@/lib/auth/server";

/** 验证后台生成的一次性邮件凭证，仅接受固定类型和固定回跳地址。 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (tokenHash && (type === "magiclink" || type === "invite")) {
    const db = await getAuthServer();
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL("/admin/security", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
