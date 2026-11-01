import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/functions/media-repo", () => ({ getSitemapMediaEntries: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportHandledError: vi.fn() }));

import sitemap from "@/app/sitemap";
import { getSitemapMediaEntries } from "@/lib/functions/media-repo";
import { SITE_URL } from "@/lib/site";

describe("sitemap", () => {
  beforeEach(() => {
    vi.mocked(getSitemapMediaEntries).mockReset();
  });

  it("固定页面不含搜索页，并附上媒体地址", async () => {
    vi.mocked(getSitemapMediaEntries).mockResolvedValue([{ path: "/movies/abc" }]);
    const urls = (await sitemap()).map(/* 只比较地址，忽略更新频率和优先级。 */ (entry) => entry.url);
    expect(urls).toEqual([`${SITE_URL}`, `${SITE_URL}/movies`, `${SITE_URL}/shows`, `${SITE_URL}/movies/abc`]);
  });

  it("媒体查询失败时退回的固定页面仍不含搜索页", async () => {
    vi.mocked(getSitemapMediaEntries).mockRejectedValue(new Error("db"));
    const urls = (await sitemap()).map(/* 只比较地址。 */ (entry) => entry.url);
    expect(urls).toEqual([`${SITE_URL}`, `${SITE_URL}/movies`, `${SITE_URL}/shows`]);
  });
});
