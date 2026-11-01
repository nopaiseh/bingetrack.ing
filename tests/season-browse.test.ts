import { describe, expect, it } from "vitest";
import {
  isDefaultSeasonBrowseQuery,
  readSeasonBrowseQuery,
  seasonBrowseHref,
  seasonBrowseSearch,
  seasonEpisodeListPath,
} from "@/lib/season-browse";

const seriesId = "50000000-0000-4000-8000-000000000002";
const seasonId = "50000000-0000-4000-8000-000000000003";

describe("season browse query", () => {
  it("把缺省、非法页码和未知筛选都视为默认第一页", () => {
    expect(readSeasonBrowseQuery("")).toEqual({ page: 1, status: "all", order: "asc" });
    expect(readSeasonBrowseQuery("?page=0&status=later&order=sideways")).toEqual({ page: 1, status: "all", order: "asc" });
    expect(readSeasonBrowseQuery("page=abc")).toEqual({ page: 1, status: "all", order: "asc" });
    expect(isDefaultSeasonBrowseQuery(readSeasonBrowseQuery("?page=1&status=all&order=asc"))).toBe(true);
  });

  it("保留有效的页码、观看状态和降序，并在地址里省略默认值", () => {
    const query = readSeasonBrowseQuery("?page=2&status=unwatched&order=desc");
    expect(query).toEqual({ page: 2, status: "unwatched", order: "desc" });
    expect(seasonBrowseSearch(query)).toBe("?page=2&status=unwatched&order=desc");
    expect(seasonBrowseSearch({ page: 1, status: "watched", order: "asc" })).toBe("?status=watched");
    expect(seasonBrowseHref(`/shows/${seriesId}/seasons/${seasonId}`, { page: 1, status: "all", order: "asc" }))
      .toBe(`/shows/${seriesId}/seasons/${seasonId}`);
  });

  it("单集接口使用与页面相同的查询串", () => {
    expect(seasonEpisodeListPath(seriesId, seasonId, { page: 3, status: "watched", order: "desc" }))
      .toBe(`/api/shows/${seriesId}/seasons/${seasonId}/episodes?page=3&status=watched&order=desc`);
  });
});
