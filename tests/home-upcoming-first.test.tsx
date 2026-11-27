import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const { getCachedUpcomingReleasesServer, getCachedTopMediaServer } = vi.hoisted(() => ({
  getCachedUpcomingReleasesServer: vi.fn(async () => []),
  getCachedTopMediaServer: vi.fn(async () => [
    { id: "m1", title: "Top", date: "", release_year: "", rating: null, genres: [], languages: [], cover_url: "" },
  ]),
}));

vi.mock("@/lib/functions/cached-media", () => ({
  getCachedReleaseYearStats: vi.fn(async () => [{ release_year: 2026, movie_count: 1 }]),
  getCachedTopMediaServer,
  getCachedMediaDistributionsServer: vi.fn(async () => ({ movies: {}, shows: {}, albums: {}, books: {} })),
  getCachedUpcomingReleasesServer,
  getCachedHomeContinue: vi.fn(async () => ({ watching: [], listening: [], reading: [] })),
}));

vi.mock("@/app/HomeDashboard", () => ({
  default: (props: { renderedOn?: string; upcoming?: unknown; topMovies?: unknown }) => (
    <div
      data-testid="home-dashboard"
      data-rendered-on={props.renderedOn ?? ""}
      data-upcoming={JSON.stringify(props.upcoming ?? null)}
      data-top-movies={JSON.stringify(props.topMovies ?? null)}
    />
  ),
}));

import HomePage, { revalidate } from "@/app/page";

describe("HomePage countdown date", () => {
  afterEach(() => {
    vi.useRealTimers();
    getCachedUpcomingReleasesServer.mockReset();
    getCachedUpcomingReleasesServer.mockResolvedValue([]);
    getCachedTopMediaServer.mockClear();
  });

  it("首页 ISR 为 1 小时，让倒计时天数跟新加坡日期走", () => {
    expect(revalidate).toBe(3600);
  });

  it("渲染时带上新加坡当天", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T04:00:00.000Z"));

    const { getByTestId } = render(await HomePage());
    expect(getByTestId("home-dashboard").dataset.renderedOn).toBe("2026-11-13");
  });

  it("新加坡午夜后，renderedOn 换成新的一天", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T16:00:00.000Z"));

    const { getByTestId } = render(await HomePage());
    expect(getByTestId("home-dashboard").dataset.renderedOn).toBe("2026-11-14");
  });

  it("即将上映降级为空时首页仍渲染其余仪表盘数据", async () => {
    getCachedUpcomingReleasesServer.mockResolvedValueOnce([]);

    const { getByTestId } = render(await HomePage());
    const root = getByTestId("home-dashboard");
    expect(JSON.parse(root.getAttribute("data-upcoming") ?? "null")).toEqual([]);
    expect(JSON.parse(root.getAttribute("data-top-movies") ?? "null")).toEqual([
      expect.objectContaining({ id: "m1", title: "Top" }),
    ]);
  });
});
