import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { deriveDashboardStats } from "@/components/dashboard/dashboard-stats";
import MusicBookCategoryPanel from "@/components/dashboard/MusicBookCategoryPanel";
import DashboardIntro from "@/components/dashboard/DashboardIntro";
import { TABS, TAB_IDS } from "@/components/dashboard/dashboard-url";
import type { MediaDistributions, Summary } from "@/lib/types";

vi.mock("@/components/AnimatedNumber", () => ({
  default: ({ value }: { value: number }) => <>{value}</>,
}));

const emptyDistributions: MediaDistributions = { movies: {}, shows: {}, albums: {}, books: {} };

function statsFor(summary: Summary[] = [], year = "All Time", distributions = emptyDistributions) {
  return deriveDashboardStats(summary, year, distributions);
}

describe("MusicBookCategoryPanel", () => {
  it("shows the music empty state without zero-value charts", () => {
    render(<MusicBookCategoryPanel stats={statsFor()} kind="music" selectedYear="All Time" />);

    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "dashboard-panel-music");
    expect(screen.getByRole("heading", { name: "暂无收听记录" })).toBeInTheDocument();
    expect(screen.queryByText("产地分布 Top 5")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("shows the books empty state without distribution cards", () => {
    render(<MusicBookCategoryPanel stats={statsFor()} kind="books" selectedYear="2024" />);

    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "dashboard-panel-books");
    expect(screen.getByRole("heading", { name: "暂无阅读记录" })).toBeInTheDocument();
    expect(screen.queryByText("主要语言 Top 5")).not.toBeInTheDocument();
  });

  it("renders album status counts, track progress, rating, and album distributions", async () => {
    const summary = [
      {
        release_year: "All Time",
        total_albums: 5,
        listened_albums: 2,
        want_albums: 3,
        total_tracks: 20,
        listened_tracks: 8,
        want_tracks: 4,
        album_avg_rating: 8.4,
      } as Summary,
    ];
    const distributions: MediaDistributions = {
      movies: {},
      shows: {},
      albums: {
        "All Time": {
          regions: [{ name: "英国", count: 2, percent: 40 }],
          languages: [{ name: "英语", count: 4, percent: 80 }],
          genres: [{ name: "摇滚", count: 3, percent: 60 }],
        },
      },
      books: {},
    };

    render(
      <MusicBookCategoryPanel
        stats={statsFor(summary, "All Time", distributions)}
        kind="music"
        selectedYear="All Time"
      />,
    );

    expect(screen.getByText("全时段 音乐 阅览进度")).toBeInTheDocument();
    expect(screen.getByText("已听")).toBeInTheDocument();
    expect(screen.getByText("想听")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "已听 8 首，共 20 首" })).toBeInTheDocument();
    expect(screen.getByText("8.4")).toBeInTheDocument();
    expect(screen.getByText("/ 10")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /已听/ })).toHaveAttribute("href", "/search?type=album&status=watched");

    expect(await screen.findByText("产地分布 Top 5")).toBeInTheDocument();
    expect(screen.getByText("英国")).toBeInTheDocument();
    expect(screen.getByText("英语")).toBeInTheDocument();
    expect(screen.getByText("摇滚")).toBeInTheDocument();
    expect(screen.queryByText("影史精选")).not.toBeInTheDocument();
  });

  it("renders book statuses and shows 暂无评分 when rating is missing", async () => {
    const summary = [
      {
        release_year: "2024",
        total_books: 4,
        read_books: 1,
        reading_books: 1,
        want_books: 2,
        book_avg_rating: null,
      } as unknown as Summary,
    ];
    const distributions: MediaDistributions = {
      movies: {},
      shows: {},
      albums: {},
      books: {
        "2024": {
          regions: [{ name: "中国", count: 2, percent: 50 }],
          languages: [],
          genres: [{ name: "小说", count: 3, percent: 75 }],
        },
      },
    };

    render(
      <MusicBookCategoryPanel stats={statsFor(summary, "2024", distributions)} kind="books" selectedYear="2024" />,
    );

    expect(screen.getByText("2024 图书 阅览进度")).toBeInTheDocument();
    expect(screen.getByText("已读")).toBeInTheDocument();
    expect(screen.getByText("在读")).toBeInTheDocument();
    expect(screen.getByText("想读")).toBeInTheDocument();
    expect(screen.getByText("暂无评分")).toBeInTheDocument();
    expect(screen.queryByText("/ 10")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /在读/ })).toHaveAttribute(
      "href",
      "/search?type=book&status=in_progress&startYear=2024&endYear=2024",
    );
    expect(await screen.findByText("产地分布 Top 5")).toBeInTheDocument();
    expect(screen.getByText("中国")).toBeInTheDocument();
    expect(screen.getByText("小说")).toBeInTheDocument();
  });

  it("omits the track progress bar when track totals are unavailable", () => {
    const summary = [
      {
        release_year: "All Time",
        total_albums: 2,
        listened_albums: 1,
        want_albums: 1,
        total_tracks: 0,
        listened_tracks: 0,
        album_avg_rating: 7,
      } as Summary,
    ];

    render(<MusicBookCategoryPanel stats={statsFor(summary)} kind="music" selectedYear="All Time" />);

    expect(screen.queryByText("曲目收听进度")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("DashboardIntro tabs", () => {
  it("exposes five tabs with keyboard switching and correct tab semantics", async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();

    render(
      <DashboardIntro
        selectedYear="All Time"
        totalMovies={1}
        totalSeries={1}
        totalTracks={1}
        totalBooks={1}
        runtimePercent={10}
        tabs={TABS}
        tabIds={TAB_IDS}
        activeTab="总览"
        onSelectTab={onSelectTab}
        years={["All Time"]}
        onSelectYear={() => undefined}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.textContent)).toEqual(["总览", "电影", "电视节目", "音乐", "图书"]);
    expect(screen.getByRole("tab", { name: "总览" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "总览" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "音乐" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "音乐" })).toHaveAttribute("aria-controls", "dashboard-panel-music");
    expect(screen.getByRole("tab", { name: "图书" })).toHaveAttribute("aria-controls", "dashboard-panel-books");

    screen.getByRole("tab", { name: "总览" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onSelectTab).toHaveBeenCalledWith("电影");
  });
});
