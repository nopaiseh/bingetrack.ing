// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/functions/cached-media", () => ({
  getCachedTopMediaServer: vi.fn(),
}));
vi.mock("@/lib/report-error", () => ({ reportHandledError: vi.fn() }));

import { GET } from "@/app/api/top-media/route";
import { getCachedTopMediaServer } from "@/lib/functions/cached-media";
import { reportHandledError } from "@/lib/report-error";
import { MediaRepositoryError } from "@/lib/functions/media-repo";

const get = (query: string) => GET(new Request(`https://www.bingetrack.ing/api/top-media?${query}`));

describe("GET /api/top-media 热门榜接口", () => {
  beforeEach(() => {
    vi.mocked(getCachedTopMediaServer).mockReset().mockResolvedValue([]);
    vi.mocked(reportHandledError).mockClear();
  });

  it("合法类型返回榜单并允许 CDN 缓存", async () => {
    const items = [{ id: "m1", title: "星际穿越", type: "movies" as const, rating: 9.1 }];
    vi.mocked(getCachedTopMediaServer).mockResolvedValue(items as never);

    const response = await get("type=movie&year=2014&limit=99");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=60");
    expect(await response.json()).toEqual(items);
    expect(getCachedTopMediaServer).toHaveBeenCalledWith("movie", "2014", 10);
  });

  it("空榜单返回 200 与空数组", async () => {
    const response = await get("type=tv_show");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(getCachedTopMediaServer).toHaveBeenCalledWith("tv_show", null, 10);
  });

  it.each(["", "type=album", "type=book", "type=music", "type=movie&year=not-a-year", "year=2024"])(
    "非法参数返回 400，不查询榜单：%s",
    async (query) => {
      const response = await get(query);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: expect.any(String) });
      expect(getCachedTopMediaServer).not.toHaveBeenCalled();
    },
  );

  it("底层查询失败返回 503 并上报", async () => {
    const cause = new MediaRepositoryError("fetch top media", { message: "db down" });
    vi.mocked(getCachedTopMediaServer).mockRejectedValue(cause);

    const response = await get("type=movie");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to load top media" });
    expect(reportHandledError).toHaveBeenCalledWith("Top media API request failed:", cause);
  });
});
