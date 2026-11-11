import { describe, expect, it } from "vitest";
import {
  isDefaultSeasonBrowseQuery,
  nextUnwatchedEpisodeNumber,
  readSeasonBrowseQuery,
  SEASON_EPISODE_PAGE_SIZE,
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

  it("季列表每页 20 集", () => {
    expect(SEASON_EPISODE_PAGE_SIZE).toBe(20);
  });

  it("下一集是最后一集已看之后的第一集未看", () => {
    expect(nextUnwatchedEpisodeNumber([])).toBeNull();
    expect(nextUnwatchedEpisodeNumber([
      { episodeNumber: 1, status: null },
      { episodeNumber: 2, status: "want_to_watch" },
    ])).toBeNull();
    expect(nextUnwatchedEpisodeNumber([
      { episodeNumber: 2, status: "watched" },
      { episodeNumber: 1, status: "watched" },
    ])).toBeNull();
    expect(nextUnwatchedEpisodeNumber([
      { episodeNumber: 1, status: "watched" },
      { episodeNumber: 2, status: "watched" },
      { episodeNumber: 3, status: null },
    ])).toBe(3);
    // 第 2 集漏看，但已看到第 3 集，下一集是第 4 集。
    expect(nextUnwatchedEpisodeNumber([
      { episodeNumber: 1, status: "watched" },
      { episodeNumber: 2, status: "want_to_watch" },
      { episodeNumber: 3, status: "watched" },
      { episodeNumber: 4, status: null },
    ])).toBe(4);
  });
});
