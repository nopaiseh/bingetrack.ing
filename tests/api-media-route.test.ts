// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/functions/search-options", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/functions/search-options")>(),
  fetchSearchOptionsServer: vi.fn().mockResolvedValue({ genres: ["剧情"], regions: ["日本"], languages: ["日语"], years: [] }),
}));
vi.mock("@/lib/functions/media-repo", () => ({ searchMediaServer: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportHandledError: vi.fn() }));

import { GET } from "@/app/api/media/route";
import { fetchSearchOptionsServer } from "@/lib/functions/search-options";
import { searchMediaServer } from "@/lib/functions/media-repo";

const get = (query: string) => GET(new Request(`https://www.bingetrack.ing/api/media?${query}`));

describe("GET /api/media", () => {
  beforeEach(() => {
    vi.mocked(searchMediaServer).mockReset().mockResolvedValue({ rows: [], total: 0 });
    vi.mocked(fetchSearchOptionsServer).mockClear();
  });

  it("现有选项正常查询并允许 CDN 缓存", async () => {
    const response = await get(`genre=${encodeURIComponent("剧情")}&region=${encodeURIComponent("日本")}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=30");
    expect(searchMediaServer).toHaveBeenCalledOnce();
  });

  it("没有类型／地区／语言筛选时不读取选项", async () => {
    expect((await get("q=matrix")).status).toBe(200);
    expect(fetchSearchOptionsServer).not.toHaveBeenCalled();
  });

  it.each([
    `genre=${encodeURIComponent("剧情,{x}")}`,
    `region=${encodeURIComponent("火星")}`,
    `language=${encodeURIComponent('"')}`,
  ])("未知筛选值返回 400，不查询数据库：%s", async (query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(searchMediaServer).not.toHaveBeenCalled();
  });
});
