import { NextResponse } from "next/server";
import { searchMediaServer } from "@/lib/functions/media-repo";
import { ApiValidationError, parseMediaSearchParams } from "@/lib/api/media-params";
import { fetchSearchOptionsServer, hasOnlyKnownTagFilters } from "@/lib/functions/search-options";
import { reportHandledError } from "@/lib/report-error";

/** 校验搜索参数（类型／地区／语言须为现有选项）并返回卡片与总数，设置 30 秒共享缓存；参数错误返回 400，查询失败返回 503。 */
export async function GET(request: Request) {
  try {
    const params = parseMediaSearchParams(new URL(request.url).searchParams);
    // 只在带类型／地区／语言筛选时读取选项（数据缓存），未知值与搜索页一样视为无效条件。
    if ((params.genre || params.region || params.language) && !hasOnlyKnownTagFilters(params, await fetchSearchOptionsServer())) {
      throw new ApiValidationError("Unknown genre, region or language");
    }
    const results = await searchMediaServer(params);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (err) {
    if (err instanceof ApiValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    reportHandledError("Media API request failed:", err);
    return NextResponse.json({ error: "Unable to load media" }, { status: 503 });
  }
}
