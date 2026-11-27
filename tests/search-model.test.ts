import { describe, expect, it } from "vitest";
import {
  CREDIT_ROLE_OPTIONS,
  TYPE_FILTER_ORDER,
  TYPE_OPTIONS,
  countActiveFilters,
  optionLabel,
  resultRange,
  resultsCountLabel,
  resultsHeading,
  sortCaption,
  statusFilterLabel,
  statusFilterOptions,
} from "@/components/search/search-model";
import { EMPTY_FILTERS } from "@/components/search/search-model";
import { SEARCH_DB_TYPES } from "@/lib/media-types";

describe("search model helpers", () => {
  it("keeps a known label and echoes an unknown value", () => {
    expect(optionLabel([{ value: "movie", label: "电影" }], "movie")).toBe("电影");
    expect(optionLabel([{ value: "movie", label: "电影" }], "unknown")).toBe("unknown");
    expect(optionLabel([], "")).toBe("");
  });

  it("keeps TYPE_FILTER_ORDER as the same set as SEARCH_DB_TYPES", () => {
    expect(new Set(TYPE_FILTER_ORDER)).toEqual(new Set(SEARCH_DB_TYPES));
  });

  it("lists only media types in type filters and person roles in creditRole order", () => {
    expect(TYPE_OPTIONS.map((option) => option.value)).toEqual([
      "movie",
      "tv_show",
      "album",
      "music",
      "book",
      "series",
    ]);
    expect(TYPE_OPTIONS.map((option) => option.label)).toEqual(["电影", "电视节目", "专辑", "歌曲", "图书", "系列"]);
    expect(TYPE_OPTIONS.some((option) => option.value === "album" && option.label === "专辑")).toBe(true);
    expect(TYPE_OPTIONS.some((option) => option.value === "music" && option.label === "歌曲")).toBe(true);
    expect(CREDIT_ROLE_OPTIONS.map((option) => option.value)).toEqual([
      "director",
      "actor",
      "artist",
      "lyricist",
      "composer",
      "author",
    ]);
    expect(CREDIT_ROLE_OPTIONS.map((option) => option.label)).toEqual(["导演", "演员", "歌手", "作词", "作曲", "作者"]);
    expect(statusFilterLabel("watched", ["music"])).toBe("已听");
    expect(statusFilterLabel("want_to_watch", ["music"])).toBe("想听");
    expect(statusFilterLabel("watching", ["music"])).toBe("在听");
    expect(statusFilterLabel("want_to_watch", ["album"])).toBe("想听");
    expect(statusFilterLabel("watched", ["album", "music"])).toBe("已听");
    expect(statusFilterLabel("watching", ["album"])).toBe("在听");
    expect(statusFilterLabel("watched", ["movie"])).toBe("已看");
    expect(statusFilterLabel("want_to_watch", ["movie"])).toBe("想看");
    expect(statusFilterLabel("watched", ["music", "movie"])).toBe("已看");
    expect(statusFilterOptions(["music"]).find((option) => option.value === "watched")?.label).toBe("已听");
    expect(statusFilterOptions(["album"]).find((option) => option.value === "want_to_watch")?.label).toBe("想听");
  });

  it("freezes the default filters and their lists", () => {
    expect(Object.isFrozen(EMPTY_FILTERS)).toBe(true);
    for (const list of Object.values(EMPTY_FILTERS)) expect(Object.isFrozen(list)).toBe(true);
  });

  it("counts only filters that leave the defaults, including an empty list", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, year: ["", ""] })).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, sort: ["date_desc"] })).toBe(0);
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        type: ["movie"],
        creditRole: ["author"],
        status: ["watched", "watching"],
        year: ["2020", ""],
        sort: ["rating_asc"],
      }),
    ).toBe(6);
    expect(countActiveFilters({ sort: [] })).toBe(0);
  });

  it("describes every sort and falls back for an unknown value", () => {
    expect(sortCaption("date_desc")).toBe("按上映日期，新到旧");
    expect(sortCaption("date_asc")).toBe("按上映日期，旧到新");
    expect(sortCaption("rating_desc")).toBe("按评分，从高到低");
    expect(sortCaption("rating_asc")).toBe("按评分，从低到高");
    expect(sortCaption("")).toBe("按上映日期，新到旧");
    expect(sortCaption("other")).toBe("按上映日期，新到旧");
  });

  it("hides the range when there are no results and pages the rest", () => {
    expect(resultRange(1, 0)).toBeNull();
    expect(resultRange(1, -3)).toBeNull();
    expect(resultRange(1, 9)).toBe("1–9 / 9");
    expect(resultRange(1, 30)).toBe("1–30 / 30");
    expect(resultRange(2, 40)).toBe("31–40 / 40");
  });

  it("keeps the generic heading while a query is still loading", () => {
    expect(resultsHeading("", 0, false)).toBe("搜索结果");
    expect(resultsHeading("旧", 0, true)).toBe("“旧”的搜索结果");
    expect(resultsHeading("旧", 0, false)).toBe("没有找到“旧”");
    expect(resultsHeading("旧", 3, false)).toBe("“旧”的搜索结果");
  });

  it("uses 首／本 for music／book-only counts and 部作品 otherwise", () => {
    expect(resultsCountLabel(0, ["music"])).toBe("找到 0 首");
    expect(resultsCountLabel(12, ["music"])).toBe("找到 12 首");
    expect(resultsCountLabel(3, ["book"])).toBe("找到 3 本");
    expect(resultsCountLabel(8, ["movie"])).toBe("找到 8 部作品");
    expect(resultsCountLabel(8, ["tv_show"])).toBe("找到 8 部作品");
    expect(resultsCountLabel(5, ["album"])).toBe("找到 5 部作品");
    expect(resultsCountLabel(9, [])).toBe("找到 9 部作品");
    expect(resultsCountLabel(4, ["music", "book"])).toBe("找到 4 部作品");
    expect(resultsCountLabel(2, ["music", "movie"])).toBe("找到 2 部作品");
    expect(resultsCountLabel(1, ["music"])).toBe("找到 1 首");
  });
});
