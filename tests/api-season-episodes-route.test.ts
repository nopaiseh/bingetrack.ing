// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/functions/cached-media", () => ({ getCachedSeasonEpisodes: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportHandledError: vi.fn() }));

import { GET } from "@/app/api/shows/[id]/seasons/[seasonId]/episodes/route";
import { getCachedSeasonEpisodes } from "@/lib/functions/cached-media";

const seriesId = "50000000-0000-4000-8000-000000000002";
const seasonId = "50000000-0000-4000-8000-000000000003";

/** 用路径参数和查询串调用单集列表接口。 */
function get(query = "", id = seriesId, season = seasonId) {
  return GET(new Request(`https://www.bingetrack.ing/api/shows/${id}/seasons/${season}/episodes${query}`), {
    params: Promise.resolve({ id, seasonId: season }),
  });
}

describe("GET /api/shows/[id]/seasons/[seasonId]/episodes", () => {
  beforeEach(() => {
    vi.mocked(getCachedSeasonEpisodes).mockReset().mockResolvedValue({
      season: { id: seasonId, seasonNumber: 1, title: "第一季", coverUrl: "", episodeCount: 2, watchedEpisodeCount: 1 },
      episodes: [],
      total: 2,
      watchedCount: 1,
      totalRuntime: 40,
      averageRating: null,
    });
  });

  it("按页面规则解析分页并允许 CDN 缓存", async () => {
    const response = await get("?page=2&status=watched&order=desc");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=60, stale-while-revalidate=300");
    await expect(response.json()).resolves.toEqual({ episodes: [], total: 2 });
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 2, 10, "watched", "desc");
  });

  it("未知筛选回退为默认条件，而不是拒绝请求", async () => {
    const response = await get("?status=nope&order=sideways&page=0");
    expect(response.status).toBe(200);
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 1, 10, "all", "asc");
  });

  it("非法 ID 或缺失的季返回 404，且不缓存", async () => {
    const invalid = await get("", "not-an-id");
    expect(invalid.status).toBe(404);
    expect(invalid.headers.get("cache-control")).toContain("no-store");
    expect(getCachedSeasonEpisodes).not.toHaveBeenCalled();

    vi.mocked(getCachedSeasonEpisodes).mockResolvedValueOnce(null);
    const missing = await get();
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toContain("no-store");
  });

  it("查询失败返回 503，且不缓存", async () => {
    vi.mocked(getCachedSeasonEpisodes).mockRejectedValueOnce(new Error("database unavailable"));
    const response = await get();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Unable to load episodes" });
  });
});
