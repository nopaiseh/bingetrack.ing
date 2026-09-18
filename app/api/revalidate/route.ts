import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireOwner } from "@/lib/auth/server";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // 1. 检查环境变量配置的独立调用密钥（供脚本、curl 或外部工具使用）
  const configuredSecret = process.env.REVALIDATE_SECRET;
  const requestSecret = request.nextUrl.searchParams.get("secret");
  if (configuredSecret && requestSecret === configuredSecret) {
    return true;
  }

  // 2. 或者检查当前请求是否来自已登录的站长会话
  try {
    await requireOwner();
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
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

export async function POST(request: NextRequest) {
  return GET(request);
}

