import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const watching = {
  showId: "show-1",
  title: "跑男",
  posterPath: "/abc.jpg",
  href: "/shows/show-1",
  nextEpisode: {
    seasonNumber: 2,
    episodeNumber: 5,
    title: null as string | null,
    href: "/shows/show-1/seasons/season-2",
  },
  seasonProgress: { seasonNumber: 2, watched: 4, total: 12 },
  lastWatchedAt: "2024-01-01T00:00:00.000Z",
};

vi.mock("@/lib/continue-watching", () => ({
  getContinueWatching: vi.fn(async () => [watching]),
}));

vi.mock("@/lib/functions/cached-media", () => ({
  getCachedReleaseYearStats: vi.fn(async () => []),
  getCachedTopMediaServer: vi.fn(async () => []),
  getCachedMediaDistributionsServer: vi.fn(async () => ({ movies: {}, shows: {} })),
  getCachedUpcomingReleasesServer: vi.fn(async () => []),
}));

vi.mock("@/app/HomeDashboard", () => ({
  default: (props: { continueWatching?: unknown }) => (
    <div data-testid="home-dashboard" data-watching={JSON.stringify(props.continueWatching ?? null)} />
  ),
}));

import HomePage from "@/app/page";

describe("HomePage continue watching", () => {
  it("passes the rail items through and drops lastWatchedAt", async () => {
    const page = await HomePage();
    const { getByTestId } = render(page);
    const items = JSON.parse(getByTestId("home-dashboard").getAttribute("data-watching") ?? "null");
    expect(items).toEqual([{
      showId: "show-1",
      title: "跑男",
      posterPath: "/abc.jpg",
      href: "/shows/show-1",
      nextEpisode: watching.nextEpisode,
      seasonProgress: watching.seasonProgress,
    }]);
    expect(JSON.stringify(items)).not.toContain("lastWatchedAt");
  });
});
