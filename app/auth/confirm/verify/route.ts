import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, readConfirmQuery } from "@/lib/auth/confirm-link";
import { getAuthServer } from "@/lib/auth/server";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
} as const;

/** 使用固定相对地址，避免反向代理的内部域名导致跨域丢失登录 Cookie。 */
function redirectWithinSite(location: "/settings" | "/manage" | "/?authError=link") {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location, ...PRIVATE_HEADERS },
  });
}

function forbidden() {
  return new NextResponse("Forbidden", {
    status: 403,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...PRIVATE_HEADERS,
    },
  });
}

function formValue(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value : null;
}

/**
 * 确认页把表单 POST 到 /auth/confirm，proxy 再改写到这里。
 * 只有这次请求会调用 verifyOtp 并写入会话 Cookie。
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return forbidden();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirectWithinSite("/?authError=link");
  }

  const parsed = readConfirmQuery({
    token_hash: formValue(form, "token_hash"),
    type: formValue(form, "type"),
    next: formValue(form, "next"),
  });
  if (!parsed.ok) return redirectWithinSite("/?authError=link");

  const db = await getAuthServer();
  const { error } = await db.auth.verifyOtp({ token_hash: parsed.tokenHash, type: parsed.type });
  if (!error) return redirectWithinSite(parsed.next);
  return redirectWithinSite("/?authError=link");
}
