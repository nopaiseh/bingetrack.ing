import { describe, expect, it } from "vitest";
import { gmt8DateKey, hasReleaseWithinSgtWindow, sgtDateKey } from "@/lib/upcoming";

// 2026-11-13 12:00 Asia/Singapore。
const sgtNoon = new Date("2026-11-13T04:00:00.000Z");

describe("hasReleaseWithinSgtWindow", () => {
  it("今天落在窗口内", () => {
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-13" }], sgtNoon)).toBe(true);
  });

  it("第 7 天仍落在窗口内", () => {
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-20" }], sgtNoon)).toBe(true);
  });

  it("第 8 天落在窗口外", () => {
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-21" }], sgtNoon)).toBe(false);
  });

  it("过去的日期落在窗口外", () => {
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-12" }], sgtNoon)).toBe(false);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2020-01-01" }], sgtNoon)).toBe(false);
  });

  it("空缺或无法解析的发行日不计入", () => {
    expect(hasReleaseWithinSgtWindow([{ releaseDate: null }], sgtNoon)).toBe(false);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: undefined }], sgtNoon)).toBe(false);
    expect(hasReleaseWithinSgtWindow([{}], sgtNoon)).toBe(false);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "" }], sgtNoon)).toBe(false);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026" }], sgtNoon)).toBe(false);
    expect(hasReleaseWithinSgtWindow([], sgtNoon)).toBe(false);
  });

  it("多条里只要有一条落在窗口内就为 true", () => {
    expect(hasReleaseWithinSgtWindow([
      { releaseDate: null },
      { releaseDate: "2026-11-12" },
      { releaseDate: "2026-11-21" },
      { releaseDate: "2026-11-20" },
    ], sgtNoon)).toBe(true);
  });

  it("新加坡午夜前按当天计算，并与 UTC 日期相同", () => {
    const justBefore = new Date("2026-11-13T15:59:59.999Z");
    expect(sgtDateKey(justBefore)).toBe("2026-11-13");
    expect(justBefore.toISOString().slice(0, 10)).toBe("2026-11-13");
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-13" }], justBefore)).toBe(true);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-20" }], justBefore)).toBe(true);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-21" }], justBefore)).toBe(false);
  });

  it("跨过新加坡午夜后按新的一天计算，即使 UTC 日期还没变", () => {
    const justAfter = new Date("2026-11-13T16:00:00.000Z");
    expect(sgtDateKey(justAfter)).toBe("2026-11-14");
    expect(gmt8DateKey(justAfter)).toBe("2026-11-14");
    expect(justAfter.toISOString().slice(0, 10)).toBe("2026-11-13");
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-13" }], justAfter)).toBe(false);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-14" }], justAfter)).toBe(true);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-21" }], justAfter)).toBe(true);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-22" }], justAfter)).toBe(false);
  });

  it("日历日补零，才能和数据库里的 YYYY-MM-DD 比较", () => {
    expect(sgtDateKey(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
  });
});
