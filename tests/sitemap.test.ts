import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/functions/media-repo", () => ({ getSitemapMediaEntries: vi.fn() }));

import sitemap from "@/app/sitemap";
import { getSitemapMediaEntries } from "@/lib/functions/media-repo";
import { SITE_URL } from "@/lib/site";

describe("sitemap", () => {
  beforeEach(() => {
    vi.mocked(getSitemapMediaEntries).mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("固定页面不含搜索页，并附上媒体地址", async () => {
    vi.mocked(getSitemapMediaEntries).mockResolvedValue([{ path: "/movies/abc" }]);
    const urls = (await sitemap()).map(/* 只比较地址，忽略更新频率和优先级。 */ (entry) => entry.url);
    expect(urls).toEqual([
      `${SITE_URL}`,
      `${SITE_URL}/movies`,
      `${SITE_URL}/shows`,
      `${SITE_URL}/albums`,
      `${SITE_URL}/books`,
      `${SITE_URL}/movies/abc`,
    ]);
  });

  it("构建期媒体查询失败时退回的固定页面仍不含搜索页", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getSitemapMediaEntries).mockRejectedValue(new Error("db"));
    const urls = (await sitemap()).map(/* 只比较地址。 */ (entry) => entry.url);
    expect(urls).toEqual([
      `${SITE_URL}`,
      `${SITE_URL}/movies`,
      `${SITE_URL}/shows`,
      `${SITE_URL}/albums`,
      `${SITE_URL}/books`,
    ]);
    expect(log).toHaveBeenCalled();
  });

  it("运行期媒体查询失败时重新抛出，避免永久缓存空站点地图", async () => {
    vi.mocked(getSitemapMediaEntries).mockRejectedValue(new Error("db"));
    await expect(sitemap()).rejects.toThrow("db");
  });
});
