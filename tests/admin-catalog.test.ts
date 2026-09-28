import { describe, expect, it } from "vitest";
import { escapeLikePattern, mediaChoiceDetail, nameOrAliasFilter, titleOrAliasFilter } from "@/lib/admin/catalog";

describe("reference search filters", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLikePattern("50%_\\")).toBe("50\\%\\_\\\\");
  });

  it("matches name or alternate name with quoted PostgREST values", () => {
    expect(nameOrAliasFilter("周星驰")).toBe('name.ilike."%周星驰%",alternate_name.ilike."%周星驰%"');
    expect(nameOrAliasFilter('a,b(c)"')).toBe('name.ilike."%a,b(c)\\"%",alternate_name.ilike."%a,b(c)\\"%"');
  });

  it("matches media title or alternate title with wildcards escaped", () => {
    // LIKE 转义后的反斜杠在 PostgREST 引号值内还要再转义一次。
    expect(titleOrAliasFilter("100%")).toBe('title.ilike."%100\\\\%%",alternate_title.ilike."%100\\\\%%"');
  });
});

describe("media choice detail", () => {
  it("describes a season by its show and number instead of the raw type", () => {
    expect(mediaChoiceDetail({ type: "tv_season", season: { season_number: 2, parent: { title: "人生切割术" } } })).toBe("人生切割术 · 第 2 季");
    expect(mediaChoiceDetail({ type: "tv_season", season: { season_number: 1, parent: null } })).toBe("未知电视节目 · 第 1 季");
  });

  it("falls back to the type label for other media", () => {
    expect(mediaChoiceDetail({ type: "tv_show", season: null })).toBe("电视节目");
    expect(mediaChoiceDetail({})).toBeUndefined();
  });
});
