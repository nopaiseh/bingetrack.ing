import { NextResponse } from "next/server";
import { getCachedSeasonEpisodes } from "@/lib/functions/cached-media";
import { isMediaId } from "@/lib/functions/media-id";
import { reportHandledError } from "@/lib/report-error";
import { readSeasonBrowseQuery, SEASON_EPISODE_PAGE_SIZE, type SeasonEpisodeListResponse } from "@/lib/season-browse";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

/** 按与季页相同的分页规则返回单集列表。默认季页不再读取查询串，筛选和翻页改由这里提供可缓存的数据。 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; seasonId: string }> },
) {
  try {
    const { id, seasonId } = await params;
    if (!isMediaId(id) || !isMediaId(seasonId)) {
      return NextResponse.json({ error: "Season not found" }, { status: 404, headers: PRIVATE_NO_STORE });
    }

    const query = readSeasonBrowseQuery(new URL(request.url).search);
    const page = await getCachedSeasonEpisodes(
      id,
      seasonId,
      query.page,
      SEASON_EPISODE_PAGE_SIZE,
      query.status,
      query.order,
    );
    if (!page) {
      return NextResponse.json({ error: "Season not found" }, { status: 404, headers: PRIVATE_NO_STORE });
    }

    const body: SeasonEpisodeListResponse = { episodes: page.episodes, total: page.total };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    reportHandledError("Season episode API request failed:", error);
    return NextResponse.json({ error: "Unable to load episodes" }, { status: 503, headers: PRIVATE_NO_STORE });
  }
}
