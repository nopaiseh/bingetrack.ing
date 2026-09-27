import { describe, expect, it } from "vitest";
import { escapeLikePattern, nameOrAliasFilter, titleOrAliasFilter } from "@/lib/admin/catalog";

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
