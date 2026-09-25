import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

/** 以固定长度摘要做常量时间比较，避免通过响应时间推测密钥。 */
function secretMatches(provided: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

/**
 * 供脚本或外部工具刷新公开缓存；只接受 POST 与 `Authorization: Bearer <REVALIDATE_SECRET>`。
 * 不读取登录 Cookie，跨站页面无法借站长会话触发；站长在管理区使用 Server Action 刷新。
 */
export async function POST(request: NextRequest) {
  const configuredSecret = process.env.REVALIDATE_SECRET?.trim();
  const provided = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!configuredSecret || !provided || !secretMatches(provided, configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag("media", { expire: 0 });
  revalidatePath("/", "layout");

  return NextResponse.json({
    revalidated: true,
    message: "公开前台与数据缓存已刷新。",
    timestamp: new Date().toISOString(),
  });
}
