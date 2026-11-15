import { describe, expect, it, vi } from "vitest";
import { daysUntil, hasReleaseWithinSgtWindow, isUpcomingDate, pickUpcoming, sgtDateKey } from "@/lib/upcoming";
import type { UpcomingRelease } from "@/lib/types";

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
    expect(
      hasReleaseWithinSgtWindow(
        [
          { releaseDate: null },
          { releaseDate: "2026-11-12" },
          { releaseDate: "2026-11-21" },
          { releaseDate: "2026-11-20" },
        ],
        sgtNoon,
      ),
    ).toBe(true);
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
    expect(justAfter.toISOString().slice(0, 10)).toBe("2026-11-13");
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-13" }], justAfter)).toBe(false);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-14" }], justAfter)).toBe(true);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-21" }], justAfter)).toBe(true);
    expect(hasReleaseWithinSgtWindow([{ releaseDate: "2026-11-22" }], justAfter)).toBe(false);
  });

  it("日历日补零，才能和数据库里的 YYYY-MM-DD 比较", () => {
    expect(sgtDateKey(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
  });

  it("模块只创建一次 Asia/Singapore 格式化器，跨午夜和补零的结果不变", async () => {
    vi.resetModules();
    const spy = vi.spyOn(Intl, "DateTimeFormat");
    try {
      const { sgtDateKey: freshKey } = await import("@/lib/upcoming");
      expect(freshKey(new Date("2026-11-13T15:59:59.999Z"))).toBe("2026-11-13");
      expect(freshKey(new Date("2026-11-13T16:00:00.000Z"))).toBe("2026-11-14");
      expect(freshKey(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
      const singapore = spy.mock.instances.filter(
        (formatter) => formatter.resolvedOptions().timeZone === "Asia/Singapore",
      );
      expect(singapore).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("即将上映日期", () => {
  const today = "2026-11-13";

  it("只把 YYYY-MM-DD 开头、且不早于今天的值当成即将上映", () => {
    expect(isUpcomingDate("2026-11-13", today)).toBe(true);
    expect(isUpcomingDate("2026-11-13T08:00:00Z", today)).toBe(true);
    expect(isUpcomingDate("2026-11-14", today)).toBe(true);
    expect(isUpcomingDate("2026-11-12", today)).toBe(false);
    expect(isUpcomingDate(null, today)).toBe(false);
    expect(isUpcomingDate(undefined, today)).toBe(false);
    expect(isUpcomingDate("", today)).toBe(false);
    expect(isUpcomingDate("2026", today)).toBe(false);
    expect(isUpcomingDate("2026-11", today)).toBe(false);
    expect(isUpcomingDate(sgtDateKey())).toBe(true);
    expect(isUpcomingDate("1999-01-01")).toBe(false);
  });

  it("按 UTC 零点计算整天差，避开本地时区", () => {
    expect(daysUntil("2026-11-13", today)).toBe(0);
    expect(daysUntil("2026-11-20", today)).toBe(7);
    expect(daysUntil("2026-11-12", today)).toBe(-1);
  });

  it("丢掉今天之前的条目，同一分组只留最早一条，再按日期和 ID 取前若干条", () => {
    const item = (id: string, groupId: string, releaseDate: string): UpcomingRelease => ({
      id,
      kind: "episode",
      groupId,
      title: id,
      releaseDate,
      cover_url: "",
      href: "/",
      genres: [],
      languages: [],
    });
    const picked = pickUpcoming(
      [
        item("late", "show-a", "2026-11-20"),
        item("past", "show-a", "2026-11-12"),
        item("b-later", "show-b", "2026-11-15"),
        item("b-early-z", "show-b", "2026-11-14"),
        item("same-b", "show-c", "2026-11-14"),
        item("same-a", "show-c", "2026-11-14"),
        item("far", "show-d", "2026-12-01"),
        item("fifth", "show-e", "2026-11-16"),
      ],
      today,
    );
    expect(picked.map((entry) => entry.id)).toEqual(["b-early-z", "same-a", "fifth", "late"]);
    expect(pickUpcoming([item("only", "show-a", "2026-11-13")], today, 1)).toHaveLength(1);
    expect(pickUpcoming([item("past", "show-a", "2026-11-12")], today)).toEqual([]);
  });
});
