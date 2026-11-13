import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const getUpcoming = vi.hoisted(() => vi.fn(async () => [] as { releaseDate: string }[]));

vi.mock("@/lib/continue-watching", () => ({
  getContinueWatching: vi.fn(async () => []),
}));

vi.mock("@/lib/functions/cached-media", () => ({
  getCachedReleaseYearStats: vi.fn(async () => []),
  getCachedTopMediaServer: vi.fn(async () => []),
  getCachedMediaDistributionsServer: vi.fn(async () => ({ movies: {}, shows: {} })),
  getCachedUpcomingReleasesServer: getUpcoming,
}));

vi.mock("@/app/HomeDashboard", () => ({
  default: (props: { upcomingFirst?: boolean; renderedOn?: string }) => (
    <div
      data-testid="home-dashboard"
      data-upcoming-first={String(props.upcomingFirst)}
      data-rendered-on={props.renderedOn ?? ""}
    />
  ),
}));

import HomePage, { revalidate } from "@/app/page";

function release(releaseDate: string) {
  return { releaseDate };
}

describe("HomePage upcomingFirst", () => {
  afterEach(() => {
    vi.useRealTimers();
    getUpcoming.mockReset();
    getUpcoming.mockResolvedValue([]);
  });

  it("首页 ISR 为 1 小时，避免 upcomingFirst 跨过新加坡午夜后陈旧一整天", () => {
    expect(revalidate).toBe(3600);
  });

  it("第 7 天的条目让 upcomingFirst 为 true，并带上同一时刻的新加坡日期", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T04:00:00.000Z"));
    getUpcoming.mockResolvedValue([release("2026-11-21"), release("2026-11-20")]);

    const { getByTestId } = render(await HomePage());
    const dashboard = getByTestId("home-dashboard");
    expect(dashboard.dataset.upcomingFirst).toBe("true");
    expect(dashboard.dataset.renderedOn).toBe("2026-11-13");
  });

  it("新加坡午夜后，UTC 的“今天”若已过期则 upcomingFirst 为 false", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T16:00:00.000Z"));
    getUpcoming.mockResolvedValue([release("2026-11-13"), release("2026-11-22")]);

    const { getByTestId } = render(await HomePage());
    const dashboard = getByTestId("home-dashboard");
    expect(dashboard.dataset.upcomingFirst).toBe("false");
    expect(dashboard.dataset.renderedOn).toBe("2026-11-14");
  });
});
