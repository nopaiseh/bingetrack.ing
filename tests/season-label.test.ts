import { describe, expect, it } from "vitest";
import { seasonListLabel } from "@/lib/season-label";

describe("seasonListLabel", () => {
  it("主标题始终是季序号，原标题与通用名不同时作为副标题", () => {
    expect(seasonListLabel({ seasonNumber: 1, title: "跑男（2010）" })).toEqual({
      title: "第 1 季",
      subtitle: "跑男（2010）",
    });
    expect(seasonListLabel({ seasonNumber: 3, title: "第 3 季" })).toEqual({
      title: "第 3 季",
      subtitle: null,
    });
    expect(seasonListLabel({ seasonNumber: 3, title: "第三季", alternateTitle: "  " })).toEqual({
      title: "第 3 季",
      subtitle: null,
    });
  });

  it("通用主标题下改用别名作为副标题", () => {
    expect(seasonListLabel({ seasonNumber: 2, title: "第2季", alternateTitle: "Running Man" })).toEqual({
      title: "第 2 季",
      subtitle: "Running Man",
    });
  });
});
