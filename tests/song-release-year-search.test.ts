import { describe, expect, it } from "vitest";
import {
  countSongsMatchingSearch,
  countTracksForReleaseYear,
  songEffectiveReleaseYear,
  type SongSearchRow,
} from "@/tests/helpers/song-release-year";
import { buildMediaSearchQuery, hasOnlyKnownFilterValues } from "@/lib/api/search-state";
import { parseMediaSearchParams } from "@/lib/api/media-params";

/**
 * 与 supabase/tests/release_year_stats_tracks.test.sql 夹具同构的内存数据：
 * 专辑 2081；专辑内无自身日期 → 2081；独立／想听 2082；自身日期／无 tracking 2083；
 * 专辑内自身日期 2084；无日期无专辑不计。
 */
const TRACK_FIXTURES: readonly SongSearchRow[] = [
  { releaseDate: null, albumReleaseDate: "2081-03-01", status: "watched" },
  { releaseDate: "2082-01-10", albumReleaseDate: null, status: "watched" },
  { releaseDate: "2083-06-15", albumReleaseDate: null, status: "watched" },
  { releaseDate: "2082-08-01", albumReleaseDate: null, status: "want_to_watch" },
  { releaseDate: null, albumReleaseDate: null, status: "watched" },
  { releaseDate: "2083-09-01", albumReleaseDate: null, status: null },
  { releaseDate: "2084-02-01", albumReleaseDate: "2081-03-01", status: "watched" },
];

describe("song release year coalesce (release_year_stats parity)", () => {
  it("uses song date when present, otherwise album date", () => {
    expect(songEffectiveReleaseYear({ releaseDate: "2084-02-01", albumReleaseDate: "2081-03-01" })).toBe(2084);
    expect(songEffectiveReleaseYear({ releaseDate: null, albumReleaseDate: "2081-03-01" })).toBe(2081);
    expect(songEffectiveReleaseYear({ releaseDate: null, albumReleaseDate: null })).toBeNull();
  });

  it("matches release_year_stats track columns for each fixture year and status", () => {
    const expectedByYear: Record<number, { total_tracks: number; listened_tracks: number; want_tracks: number }> = {
      2081: { total_tracks: 1, listened_tracks: 1, want_tracks: 0 },
      2082: { total_tracks: 2, listened_tracks: 1, want_tracks: 1 },
      2083: { total_tracks: 2, listened_tracks: 1, want_tracks: 0 },
      2084: { total_tracks: 1, listened_tracks: 1, want_tracks: 0 },
    };

    for (const [yearText, expected] of Object.entries(expectedByYear)) {
      const year = Number(yearText);
      const stats = countTracksForReleaseYear(TRACK_FIXTURES, year);
      expect(stats).toEqual(expected);

      // type=music&startYear=&endYear= 对应 total_tracks
      expect(countSongsMatchingSearch(TRACK_FIXTURES, { startYear: yearText, endYear: yearText })).toBe(
        expected.total_tracks,
      );

      // status=watched → listened_tracks
      expect(
        countSongsMatchingSearch(TRACK_FIXTURES, {
          startYear: yearText,
          endYear: yearText,
          status: ["watched"],
        }),
      ).toBe(expected.listened_tracks);

      // status=want_to_watch → want_tracks
      expect(
        countSongsMatchingSearch(TRACK_FIXTURES, {
          startYear: yearText,
          endYear: yearText,
          status: ["want_to_watch"],
        }),
      ).toBe(expected.want_tracks);
    }
  });

  it("All Time stats exclude songs with neither date; year-less search still counts them", () => {
    const allTime = countTracksForReleaseYear(TRACK_FIXTURES, "All Time");
    expect(allTime).toEqual({ total_tracks: 6, listened_tracks: 4, want_tracks: 1 });
    // 无年份参数时搜索不过滤日期，含「无日期无专辑」一首 → 7
    expect(countSongsMatchingSearch(TRACK_FIXTURES, {})).toBe(7);
  });
});

describe("public search accepts type=music", () => {
  it("allows music in URL filters and API params with year and status", () => {
    const url = new URLSearchParams({
      type: "music",
      status: "watched",
      startYear: "2020",
      endYear: "2020",
    });
    expect(hasOnlyKnownFilterValues(url)).toBe(true);

    const query = buildMediaSearchQuery(url);
    expect(parseMediaSearchParams(new URLSearchParams(query))).toEqual(
      expect.objectContaining({
        type: "music",
        status: "watched",
        startYear: "2020",
        endYear: "2020",
        limit: 30,
        offset: 0,
      }),
    );
  });
});
