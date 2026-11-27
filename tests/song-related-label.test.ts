import { describe, expect, it } from "vitest";
import { buildRelatedSongRelationLabel } from "@/lib/song/related-label";

describe("buildRelatedSongRelationLabel", () => {
  it("按固定顺序拼接演唱・作曲・作词", () => {
    expect(buildRelatedSongRelationLabel(["lyricist", "artist", "composer"])).toBe("演唱・作曲・作词");
  });

  it("子集关系只输出出现的角色", () => {
    expect(buildRelatedSongRelationLabel(["artist", "lyricist"])).toBe("演唱・作词");
    expect(buildRelatedSongRelationLabel(["composer"])).toBe("作曲");
  });

  it("去重、忽略未知角色与代词式空值", () => {
    expect(buildRelatedSongRelationLabel(["artist", "artist", "unknown", "他"])).toBe("演唱");
  });

  it("空或缺失返回空串", () => {
    expect(buildRelatedSongRelationLabel([])).toBe("");
    expect(buildRelatedSongRelationLabel(null)).toBe("");
    expect(buildRelatedSongRelationLabel(undefined)).toBe("");
  });
});
