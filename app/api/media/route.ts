import { NextResponse } from "next/server";
import { searchMediaServer } from "@/lib/functions/media-repo";
import { ApiValidationError, parseMediaSearchParams } from "@/lib/api/media-params";

/** 校验搜索参数并返回卡片与总数，设置 30 秒共享缓存；参数错误返回 400，查询失败返回 503。 */
export async function GET(request: Request) {
  try {
    const params = parseMediaSearchParams(new URL(request.url).searchParams);
    const results = await searchMediaServer(params);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (err) {
    if (err instanceof ApiValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Media API request failed:", err);
    return NextResponse.json({ error: "Unable to load media" }, { status: 503 });
  }
}
