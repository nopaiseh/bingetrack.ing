import { describe, expect, it } from "vitest";
import {
  TYPE_OPTIONS,
  countActiveFilters,
  optionLabel,
  resultRange,
  resultsHeading,
  sortCaption,
  statusFilterLabel,
  statusFilterOptions,
} from "@/components/search/search-model";
import { EMPTY_FILTERS } from "@/components/search/search-model";

describe("search model helpers", () => {
  it("keeps a known label and echoes an unknown value", () => {
    expect(optionLabel([{ value: "movie", label: "电影" }], "movie")).toBe("电影");
    expect(optionLabel([{ value: "movie", label: "电影" }], "unknown")).toBe("unknown");
    expect(optionLabel([], "")).toBe("");
  });

  it("lists 单曲 in type filters and uses 已听／想听 when only music is selected", () => {
    expect(TYPE_OPTIONS.some((option) => option.value === "music" && option.label === "单曲")).toBe(true);
    expect(statusFilterLabel("watched", ["music"])).toBe("已听");
    expect(statusFilterLabel("want_to_watch", ["music"])).toBe("想听");
    expect(statusFilterLabel("watched", ["movie"])).toBe("已看");
    expect(statusFilterLabel("watched", ["music", "movie"])).toBe("已看");
    expect(statusFilterOptions(["music"]).find((option) => option.value === "watched")?.label).toBe("已听");
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
        status: ["watched", "watching"],
        year: ["2020", ""],
        sort: ["rating_asc"],
      }),
    ).toBe(5);
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
});
