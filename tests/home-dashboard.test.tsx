import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { buildMediaDistributions } from "@/lib/functions/media-distributions";
import type { Summary } from "@/lib/types";

vi.mock("next/dynamic", () => ({
  default: () => function DynamicStub(props: { title?: string }) {
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
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));

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
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]")));
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
      <HomeDashboard
        summary={[]}
        topMovies={[]}
        topSeries={[]}
        distributions={buildMediaDistributions([])}
      />,
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

  function renderDashboard(upcomingFirst?: boolean) {
    const props = {
      summary: [],
      topMovies: [],
      topSeries: [],
      distributions: buildMediaDistributions([]),
      upcoming: [{ id: "next-release" } as never],
      continueWatching: [watchingItem],
      ...(upcomingFirst === undefined ? {} : { upcomingFirst }),
    };
    return render(<HomeDashboard {...props} />);
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

  it("upcomingFirst 为 true 时即将上映排在继续观看前面", () => {
    const { container } = renderDashboard(true);
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.upcomingFirst).toBe("true");
    expect(leadBlockOrder(container)).toEqual(["upcoming", "continue"]);
    const heading = screen.getByRole("heading", { name: "继续观看" });
    const upcoming = screen.getByTestId("upcoming");
    expect(upcoming.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("upcomingFirst 为 false 或缺省时继续观看排在即将上映前面", () => {
    const { container, rerender } = renderDashboard();
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.upcomingFirst).toBe("false");
    expect(leadBlockOrder(container)).toEqual(["continue", "upcoming"]);

    rerender(
      <HomeDashboard
        summary={[]}
        topMovies={[]}
        topSeries={[]}
        distributions={buildMediaDistributions([])}
        upcoming={[{ id: "next-release" } as never]}
        continueWatching={[watchingItem]}
        upcomingFirst={false}
      />,
    );
    expect(root.dataset.upcomingFirst).toBe("false");
    expect(leadBlockOrder(container)).toEqual(["continue", "upcoming"]);
    const heading = screen.getByRole("heading", { name: "继续观看" });
    const upcoming = screen.getByTestId("upcoming");
    expect(heading.compareDocumentPosition(upcoming) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
