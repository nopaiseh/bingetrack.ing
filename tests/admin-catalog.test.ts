import { describe, expect, it } from "vitest";
import { escapeLikePattern, nameOrAliasFilter } from "@/lib/admin/catalog";

describe("reference search filters", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLikePattern("50%_\\")).toBe("50\\%\\_\\\\");
  });

  it("matches name or alternate name with quoted PostgREST values", () => {
    expect(nameOrAliasFilter("周星驰")).toBe('name.ilike."%周星驰%",alternate_name.ilike."%周星驰%"');
    expect(nameOrAliasFilter('a,b(c)"')).toBe('name.ilike."%a,b(c)\\"%",alternate_name.ilike."%a,b(c)\\"%"');
  });
});
