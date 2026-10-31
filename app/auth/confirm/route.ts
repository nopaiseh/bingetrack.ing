import { NextResponse, type NextRequest } from "next/server";
import { getAuthServer } from "@/lib/auth/server";

/** 使用固定相对地址，避免反向代理的内部域名导致跨域丢失登录 Cookie。 */
function redirectWithinSite(location: "/settings" | "/manage" | "/?authError=link") {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "private, no-store" },
  });
}

/** 验证后台生成的一次性邮件凭证，仅接受固定类型和固定回跳地址。 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = request.nextUrl.searchParams.get("next");
  if (tokenHash && (type === "magiclink" || type === "invite")) {
    const db = await getAuthServer();
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return redirectWithinSite(next === "/manage" ? "/manage" : "/settings");
  }
  return redirectWithinSite("/?authError=link");
}
