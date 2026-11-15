import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { buildMediaDistributions } from "@/lib/functions/media-distributions";
import type { Summary } from "@/lib/types";

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicStub(props: { title?: string }) {
      return <div data-testid="dynamic" data-title={props.title ?? ""} />;
    },
}));

vi.mock("@/components/LoadingSkeletons", () => ({
  PosterRowSkeleton: () => <div data-testid="poster-skeleton" />,
}));

vi.mock("@/components/UpcomingHero", () => ({
  default: ({ items }: { items: { id: string }[] }) => (
    <div data-testid="upcoming" data-ids={items.map((item) => item.id).join(",")} />
  ),
}));
vi.mock("@/components/AnimatedNumber", () => ({ default: ({ value }: { value: number }) => <>{value}</> }));

vi.mock("@/components/DashboardYearPicker", () => ({
  default: ({ years, onSelect }: { years: string[]; onSelect: (year: string) => void }) => (
    <div>
      {["All Time", ...years].map((year) => (
        <button key={year} type="button" onClick={() => onSelect(year)}>{`year-${year}`}</button>
      ))}
    </div>
  ),
}));

import HomeDashboard from "@/app/HomeDashboard";
import type { ContinueWatchingCard } from "@/components/ContinueWatchingRail";

describe("HomeDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("年份榜单请求未完成时切回全时段，不会停留在加载骨架", async () => {
    // 请求一直挂起，只在取消时拒绝，模拟用户在响应前切回全时段。
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    );

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    fireEvent.click(screen.getByText("year-2024"));
    expect(screen.getByTestId("poster-skeleton")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("year-All Time"));
    });

    expect(screen.queryByTestId("poster-skeleton")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("dynamic").some((element) => element.dataset.title === "影史精选")).toBe(true);
  });

  it("倒计时展台不随年份切换而变化", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]")),
    );
    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        distributions={buildMediaDistributions([])}
        upcoming={[{ id: "next-release" } as never]}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });
    expect(screen.getByTestId("upcoming").dataset.ids).toBe("next-release");
  });

  it("把继续观看放在看板最上方，没有条目时不占位", () => {
    const { rerender } = render(
      <HomeDashboard summary={[]} topMovies={[]} topSeries={[]} distributions={buildMediaDistributions([])} />,
    );
    expect(screen.queryByRole("heading", { name: "继续观看" })).not.toBeInTheDocument();

    const item: ContinueWatchingCard = {
      showId: "show-1",
      title: "跑男",
      posterPath: null,
      href: "/shows/show-1",
      nextEpisode: null,
      seasonProgress: { seasonNumber: 1, watched: 1, total: 1 },
    };
    rerender(
      <HomeDashboard
        summary={[]}
        topMovies={[]}
        topSeries={[]}
        distributions={buildMediaDistributions([])}
        continueWatching={[item]}
      />,
    );
    expect(screen.getByRole("heading", { name: "继续观看" })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/shows/show-1");
  });

  const watchingItem: ContinueWatchingCard = {
    showId: "show-1",
    title: "跑男",
    posterPath: null,
    href: "/shows/show-1",
    nextEpisode: null,
    seasonProgress: { seasonNumber: 1, watched: 1, total: 1 },
  };

  function renderDashboard() {
    return render(
      <HomeDashboard
        summary={[]}
        topMovies={[]}
        topSeries={[]}
        distributions={buildMediaDistributions([])}
        upcoming={[{ id: "next-release" } as never]}
        continueWatching={[watchingItem]}
      />,
    );
  }

  /** 只看这两个区块在 DOM 里的先后，不看 CSS order。 */
  function leadBlockOrder(container: HTMLElement) {
    const root = container.firstElementChild as HTMLElement;
    const labels: string[] = [];
    for (const child of root.children) {
      const element = child as HTMLElement;
      expect(element.style.order).toBe("");
      expect(element.className).not.toMatch(/\border-/);
      if (element.dataset.testid === "upcoming") labels.push("upcoming");
      else if (element.querySelector("#continue-watching-heading")) labels.push("continue");
      else break;
    }
    return labels;
  }

  it("放映单始终先放倒计时，再放继续观看", () => {
    const { container } = renderDashboard();
    expect(leadBlockOrder(container)).toEqual(["upcoming", "continue"]);
    const heading = screen.getByRole("heading", { name: "继续观看" });
    const upcoming = screen.getByTestId("upcoming");
    expect(upcoming.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("不渲染全时段四格统计，年份切换只更新媒体全景", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]")),
    );
    window.history.replaceState(null, "", "/");

    render(
      <HomeDashboard
        summary={[
          {
            release_year: "All Time",
            watched_movies: 60,
            unwatched_movies: 7,
            watched_series: 4,
            watching_series: 3,
            total_watched_runtime: 66,
            total_runtime: 100,
            watched_series_episodes: 132,
            total_series_episodes: 245,
          } as Summary,
          {
            release_year: "2024",
            watched_movies: 1,
            unwatched_movies: 2,
            watched_series: 0,
            watching_series: 1,
            total_watched_runtime: 1,
            total_runtime: 10,
            watched_series_episodes: 2,
            total_series_episodes: 10,
          } as Summary,
        ]}
        topMovies={[]}
        topSeries={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    expect(screen.queryByRole("region", { name: "全时段统计" })).not.toBeInTheDocument();
    const intro = screen.getByRole("region", { name: "媒体全景" });
    expect(intro).toHaveTextContent("全时段档案");
    expect(intro).toHaveTextContent("67");

    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });

    expect(screen.queryByRole("region", { name: "全时段统计" })).not.toBeInTheDocument();
    expect(intro).toHaveTextContent("2024 年度档案");
    expect(intro).toHaveTextContent("3");
    expect(intro).not.toHaveTextContent("67");
  });
});
