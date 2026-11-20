import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/functions/cached-media", () => ({
  getCachedReleaseYearStats: vi.fn(async () => []),
  getCachedTopMediaServer: vi.fn(async () => []),
  getCachedMediaDistributionsServer: vi.fn(async () => ({ movies: {}, shows: {} })),
  getCachedUpcomingReleasesServer: vi.fn(async () => []),
  getCachedHomeContinue: vi.fn(async () => ({ watching: [], listening: [] })),
}));

vi.mock("@/app/HomeDashboard", () => ({
  default: (props: { renderedOn?: string }) => (
    <div data-testid="home-dashboard" data-rendered-on={props.renderedOn ?? ""} />
  ),
}));

import HomePage, { revalidate } from "@/app/page";

describe("HomePage countdown date", () => {
  afterEach(() => {
    vi.useRealTimers();
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
});
