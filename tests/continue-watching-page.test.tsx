import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const { watching, listening, getCachedHomeContinue } = vi.hoisted(() => {
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
  const listening = {
    albumId: "album-1",
    title: "专辑",
    posterPath: "https://is1-ssl.mzstatic.com/image/thumb/cover.jpg",
    href: "/albums/album-1",
    trackProgress: { watched: 2, total: 5 },
    latestWatchedTrackReleaseAt: "2024-02-01T00:00:00.000Z",
  };
  return {
    watching,
    listening,
    getCachedHomeContinue: vi.fn(async () => ({ watching: [watching], listening: [listening] })),
  };
});

vi.mock("@/lib/functions/cached-media", () => ({
  getCachedReleaseYearStats: vi.fn(async () => []),
  getCachedTopMediaServer: vi.fn(async () => []),
  getCachedMediaDistributionsServer: vi.fn(async () => ({ movies: {}, shows: {}, albums: {} })),
  getCachedUpcomingReleasesServer: vi.fn(async () => []),
  getCachedHomeContinue,
}));

vi.mock("@/app/HomeDashboard", () => ({
  default: (props: { continueWatching?: unknown; continueListening?: unknown }) => (
    <div
      data-testid="home-dashboard"
      data-watching={JSON.stringify(props.continueWatching ?? null)}
      data-listening={JSON.stringify(props.continueListening ?? null)}
    />
  ),
}));

import HomePage from "@/app/page";

describe("HomePage continue watching", () => {
  it("passes watching and listening rails through and drops time proxy fields", async () => {
    const page = await HomePage();
    expect(getCachedHomeContinue).toHaveBeenCalledOnce();
    const { getByTestId } = render(page);
    const root = getByTestId("home-dashboard");
    const items = JSON.parse(root.getAttribute("data-watching") ?? "null");
    const listeningItems = JSON.parse(root.getAttribute("data-listening") ?? "null");
    expect(items).toEqual([
      {
        showId: "show-1",
        title: "跑男",
        posterPath: "/abc.jpg",
        href: "/shows/show-1",
        nextEpisode: watching.nextEpisode,
        seasonProgress: watching.seasonProgress,
      },
    ]);
    expect(listeningItems).toEqual([
      {
        albumId: "album-1",
        title: "专辑",
        posterPath: "https://is1-ssl.mzstatic.com/image/thumb/cover.jpg",
        href: "/albums/album-1",
        trackProgress: listening.trackProgress,
      },
    ]);
    expect(JSON.stringify(items)).not.toContain("lastWatchedAt");
    expect(JSON.stringify(listeningItems)).not.toContain("latestWatchedTrackReleaseAt");
  });
});
