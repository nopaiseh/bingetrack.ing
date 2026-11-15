import { describe, expect, it } from "vitest";
import { changeSearchYear, toggleSearchFilter, toggleSearchSort } from "@/components/search/search-filters";
import { EMPTY_FILTERS } from "@/components/search/search-model";

describe("toggleSearchFilter", () => {
  it("adds, removes, and replaces a value", () => {
    const added = toggleSearchFilter(EMPTY_FILTERS, "type", "movie", true, ["movie", "tv_show"]);
    expect(added.type).toEqual(["movie"]);
    expect(added.sort).toEqual(["date_desc"]);

    const removed = toggleSearchFilter(added, "type", "movie", true, ["movie", "tv_show"]);
    expect(removed.type).toEqual([]);

    const replaced = toggleSearchFilter({ ...EMPTY_FILTERS, type: ["movie"] }, "type", "tv_show", false);
    expect(replaced.type).toEqual(["tv_show"]);
  });

  it("clears a category for 全部 and collapses a fully selected list", () => {
    const cleared = toggleSearchFilter({ ...EMPTY_FILTERS, status: ["watched"] }, "status", "全部");
    expect(cleared.status).toEqual([]);

    const collapsed = toggleSearchFilter(
      { ...EMPTY_FILTERS, genre: ["剧情"] },
      "genre",
      "喜剧",
      true,
      ["剧情", "喜剧"],
    );
    expect(collapsed.genre).toEqual([]);
  });

  it("treats a missing category as empty", () => {
    const next = toggleSearchFilter({ sort: ["date_desc"] }, "region", "日本");
    expect(next.region).toEqual(["日本"]);
  });
});

describe("toggleSearchSort", () => {
  it("reverses the current field and defaults a new field to descending", () => {
    expect(toggleSearchSort(EMPTY_FILTERS, "date").sort).toEqual(["date_asc"]);
    expect(toggleSearchSort({ ...EMPTY_FILTERS, sort: ["date_asc"] }, "date").sort).toEqual(["date_desc"]);
    expect(toggleSearchSort(EMPTY_FILTERS, "rating").sort).toEqual(["rating_desc"]);
    expect(toggleSearchSort({ ...EMPTY_FILTERS, sort: [] }, "rating").sort).toEqual(["rating_desc"]);
  });
});

describe("changeSearchYear", () => {
  it("sets one end and pulls the other end when the range is inverted", () => {
    expect(changeSearchYear(EMPTY_FILTERS, "start", "2019").year).toEqual(["2019", ""]);
    expect(changeSearchYear({ ...EMPTY_FILTERS, year: ["2010", "2020"] }, "end", "2018").year).toEqual(["2010", "2018"]);
    expect(changeSearchYear({ ...EMPTY_FILTERS, year: ["", "2010"] }, "start", "2020").year).toEqual(["2020", "2020"]);
    expect(changeSearchYear({ ...EMPTY_FILTERS, year: ["2020", ""] }, "end", "2010").year).toEqual(["2010", "2010"]);
  });
});
