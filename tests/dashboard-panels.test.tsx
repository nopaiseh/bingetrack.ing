import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { deriveDashboardStats } from "@/components/dashboard/dashboard-stats";
import DashboardCategoryPanel from "@/components/dashboard/DashboardCategoryPanel";
import OverviewBoards from "@/components/dashboard/OverviewBoards";
import type { MediaCard, MediaDistributions, Summary } from "@/lib/types";

const distributions: MediaDistributions = { movies: {}, shows: {}, albums: {}, books: {} };

function statsFor(summary: Summary[] = [], year = "All Time") {
  return deriveDashboardStats(summary, year, distributions);
}

function card(cover: string): MediaCard {
  return {
    id: "m1",
    title: cover ? "有海报" : "无海报",
    date: "2020-01-01",
    rating: 8,
    genres: ["剧情"],
    languages: ["汉语"],
    cover_url: cover,
    type: "movies",
    status: "watched",
  };
}

describe("OverviewBoards", () => {
  it("renders zero boards when there is no year data", () => {
    render(<OverviewBoards stats={statsFor()} selectedYear="All Time" />);
    expect(screen.getByText("电影看板")).toBeInTheDocument();
    expect(screen.getByText("电视节目看板")).toBeInTheDocument();
    expect(screen.getByText("0 / 0 部 · 0%")).toBeInTheDocument();
    expect(screen.getByText("0 / 0 集 · 0%")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/search?type=movie&status=watched"),
    ).toBe(true);
  });

  it("shows movie totals and season details from the stats object", () => {
    const summary = [
      {
        release_year: "2024",
        watched_movies: 4,
        unwatched_movies: 6,
        watched_series: 2,
        watching_series: 1,
        unwatched_series: 3,
        watched_series_episodes: 12,
        unwatched_episodes: 30,
        total_series_episodes: 42,
        watched_seasons: 3,
        watching_seasons: 1,
        unwatched_seasons: 4,
      } as Summary,
    ];
    render(<OverviewBoards stats={statsFor(summary, "2024")} selectedYear="2024" />);
    expect(screen.getByText("4 / 10 部 · 40%")).toBeInTheDocument();
    expect(screen.getByText("12 / 42 集 · 29%")).toBeInTheDocument();
    expect(screen.getByText("3季 · 12集")).toBeInTheDocument();
    expect(screen.getByText("1季")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link")
        .some(
          (link) =>
            link.getAttribute("href") === "/search?type=tv_show&status=want_to_watch&startYear=2024&endYear=2024",
        ),
    ).toBe(true);
  });
});

describe("DashboardCategoryPanel", () => {
  it("renders the movie spotlight and a placeholder when the poster is missing", async () => {
    render(
      <DashboardCategoryPanel
        stats={statsFor()}
        panelKey="movies"
        categoryName="电影"
        isTopMediaLoading={false}
        allTimeTitle="影史精选"
        selectedYear="All Time"
        allTimeItems={[card("")]}
        yearItems={[]}
        mediaType="movies"
        searchType="movie"
      />,
    );

    expect(await screen.findByRole("heading", { name: "无海报" })).toBeInTheDocument();
    expect(screen.getByText("影史精选")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "无海报" })).not.toBeInTheDocument();
    const tile = document.querySelector(".letter-tile");
    expect(tile).toBeInTheDocument();
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveAttribute("data-initial", "无");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "dashboard-panel-movies");
  });

  it("renders a poster image for a show that has a cover", async () => {
    render(
      <DashboardCategoryPanel
        stats={statsFor()}
        panelKey="tv-shows"
        categoryName="电视节目"
        isTopMediaLoading={false}
        allTimeTitle="剧集精选"
        selectedYear="All Time"
        allTimeItems={[{ ...card("/poster.jpg"), type: "shows", title: "有海报" }]}
        yearItems={[]}
        mediaType="shows"
        searchType="tv_show"
      />,
    );

    const image = await screen.findByRole("presentation");
    expect(image).toHaveAttribute("alt", "");
    expect(image.getAttribute("src") ?? "").toContain("poster.jpg");
    expect(screen.getByRole("link", { name: /有海报/ })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "有海报" })).not.toBeInTheDocument();
    expect(screen.getByText("剧集精选")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "dashboard-panel-tv-shows");
  });
});
