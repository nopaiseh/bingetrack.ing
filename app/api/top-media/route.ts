import { NextResponse } from "next/server";
import { fetchTopMediaServer } from "@/lib/functions/media-repo";
import { ApiValidationError, parseTopMediaParams } from "@/lib/api/media-params";

/** 校验榜单类型、年份与数量并返回排名结果，设置 60 秒共享缓存；参数错误返回 400，查询失败返回 503。 */
export async function GET(request: Request) {
  try {
    const { type, year, limit } = parseTopMediaParams(new URL(request.url).searchParams);
    const items = await fetchTopMediaServer(type, year, limit);
    return NextResponse.json(items, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Top media API request failed:", error);
    return NextResponse.json({ error: "Unable to load top media" }, { status: 503 });
  }
}
