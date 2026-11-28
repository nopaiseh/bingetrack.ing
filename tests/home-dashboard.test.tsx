import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { buildMediaDistributions } from "@/lib/functions/media-distributions";
import type { Summary } from "@/lib/types";

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicStub(props: { title?: string; items?: Array<{ title?: string }> }) {
      return (
        <div data-testid="dynamic" data-title={props.title ?? ""}>
          {(props.items ?? []).map((item, index) => (
            <h3 key={`${item.title ?? "item"}-${index}`}>{item.title}</h3>
          ))}
        </div>
      );
    },
}));

vi.mock("@/components/LoadingSkeletons", () => ({
  PosterRowSkeleton: () => <div data-testid="poster-skeleton" />,
}));

vi.mock("@/components/UpcomingHero", async () => {
  const { pickUpcoming } = await import("@/lib/upcoming");
  return {
    default: ({ items, renderedOn }: { items: UpcomingRelease[]; renderedOn?: string }) => {
      const visible = pickUpcoming(items ?? [], renderedOn ?? "2099-01-01", 10);
      if (!visible.length) return null;
      return <div data-testid="upcoming" data-ids={visible.map((item) => item.id).join(",")} />;
    },
  };
});
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
import type { UpcomingRelease } from "@/lib/types";

const futureUpcoming: UpcomingRelease = {
  id: "next-release",
  kind: "movie",
  groupId: "next-release",
  title: "Next",
  releaseDate: "2099-06-01",
  cover_url: "",
  href: "/movies/next",
  genres: [],
  languages: [],
};

const pastUpcoming: UpcomingRelease = {
  id: "past-release",
  kind: "movie",
  groupId: "past-release",
  title: "Past",
  releaseDate: "2020-01-01",
  cover_url: "",
  href: "/movies/past",
  genres: [],
  languages: [],
};

describe("HomeDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
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
        topAlbums={[]}
        topBooks={[]}
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
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
        upcoming={[futureUpcoming]}
        renderedOn="2026-09-27"
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });
    expect(screen.getByTestId("upcoming").dataset.ids).toBe("next-release");
  });

  it("总览标签下切换年份时并行请求四类精选", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response("[]")),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });

    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls).toEqual(
      expect.arrayContaining([
        "/api/top-media?type=movie&year=2024",
        "/api/top-media?type=tv_show&year=2024",
        "/api/top-media?type=album&year=2024",
        "/api/top-media?type=book&year=2024",
      ]),
    );
    expect(urls).toHaveLength(4);
  });

  it("单类型标签只请求当前标签需要的精选", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response("[]")),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });

    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls).toEqual(["/api/top-media?type=movie&year=2024"]);
  });

  it("某一类型失败时不影响其它类型已加载的数据", async () => {
    const movieCard = {
      id: "m1",
      title: "成功电影",
      date: "2024-01-01",
      rating: 8,
      genres: [],
      languages: [],
      cover_url: "/m.jpg",
      type: "movies",
      dbType: "movie",
      status: "watched",
    };
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => {
      const url = String(input);
      if (url.includes("type=movie")) {
        return Promise.resolve(new Response(JSON.stringify([movieCard])));
      }
      if (url.includes("type=tv_show")) {
        return Promise.resolve(new Response("boom", { status: 500 }));
      }
      return Promise.resolve(new Response("[]"));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    });
    expect(await screen.findByRole("heading", { name: "成功电影" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "电视节目" }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("年度精选暂时无法加载");
    expect(screen.queryByRole("heading", { name: "成功电影" })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    });
    expect(screen.getByRole("heading", { name: "成功电影" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("type=movie"))).toHaveLength(1);
  });

  it("已缓存的年份与类型切回时不重新请求", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response("[]")),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByText("year-All Time"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(["/api/top-media?type=movie&year=2024"]);
  });

  it("重试进行中切换标签时，旧 effect cleanup 不会清掉重试的在途状态或写回过期错误", async () => {
    const movieCard = {
      id: "m-retry",
      title: "重试成功电影",
      date: "2024-01-01",
      rating: 8,
      genres: [],
      languages: [],
      cover_url: "/m.jpg",
      type: "movies",
      dbType: "movie",
      status: "watched",
    };
    let resolveRetry: ((value: Response) => void) | undefined;
    let movieAttempts = 0;
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => {
      const url = String(input);
      if (url === "/api/top-media?type=movie&year=2024") {
        movieAttempts += 1;
        if (movieAttempts === 1) {
          return Promise.resolve(new Response("boom", { status: 500 }));
        }
        return new Promise((resolve) => {
          resolveRetry = resolve;
        });
      }
      return Promise.resolve(new Response("[]"));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("年度精选暂时无法加载");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重试" }));
    });
    expect(screen.getByTestId("poster-skeleton")).toBeInTheDocument();
    const callsAfterRetry = fetchMock.mock.calls.length;

    // 切到总览会跑旧电影 effect 的 cleanup；不应再为电影发起第二请求。
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "总览" }));
    });
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("type=movie"))).toHaveLength(2);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterRetry);

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    });
    expect(screen.getByTestId("poster-skeleton")).toBeInTheDocument();
    // 重试仍在途，切回电影标签不应再打 movie 接口。
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("type=movie"))).toHaveLength(2);

    await act(async () => {
      resolveRetry?.(new Response(JSON.stringify([movieCard])));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "重试成功电影" })).toBeInTheDocument();
  });

  it("重试进行中切到已缓存年份时直接显示数据，不停留在骨架屏", async () => {
    const movie2025 = {
      id: "m2025",
      title: "二零二五电影",
      date: "2025-01-01",
      rating: 9,
      genres: [],
      languages: [],
      cover_url: "/2025.jpg",
      type: "movies",
      dbType: "movie",
      status: "watched",
    };
    let resolveRetry: ((value: Response) => void) | undefined;
    let movie2024Attempts = 0;
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => {
      const url = String(input);
      if (url === "/api/top-media?type=movie&year=2025") {
        return Promise.resolve(new Response(JSON.stringify([movie2025])));
      }
      if (url === "/api/top-media?type=movie&year=2024") {
        movie2024Attempts += 1;
        if (movie2024Attempts === 1) {
          return Promise.resolve(new Response("boom", { status: 500 }));
        }
        return new Promise((resolve) => {
          resolveRetry = resolve;
        });
      }
      return Promise.resolve(new Response("[]"));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary, { release_year: "2025" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    await act(async () => {
      fireEvent.click(screen.getByText("year-2025"));
    });
    expect(await screen.findByRole("heading", { name: "二零二五电影" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("年度精选暂时无法加载");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重试" }));
    });
    expect(screen.getByTestId("poster-skeleton")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("year-2025"));
    });
    expect(screen.queryByTestId("poster-skeleton")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "二零二五电影" })).toBeInTheDocument();

    await act(async () => {
      resolveRetry?.(new Response(JSON.stringify([])));
    });
    expect(screen.queryByTestId("poster-skeleton")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "二零二五电影" })).toBeInTheDocument();
  });

  it("某年单类型失败后切回已缓存年份，不泄漏错误且仍渲染数据", async () => {
    const movie2025 = {
      id: "m2025",
      title: "二零二五电影",
      date: "2025-01-01",
      rating: 9,
      genres: [],
      languages: [],
      cover_url: "/2025.jpg",
      type: "movies",
      dbType: "movie",
      status: "watched",
    };
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => {
      const url = String(input);
      if (url.includes("year=2025")) {
        return Promise.resolve(new Response(JSON.stringify(url.includes("type=movie") ? [movie2025] : [])));
      }
      if (url.includes("year=2024") && url.includes("type=movie")) {
        return Promise.resolve(new Response("boom", { status: 500 }));
      }
      return Promise.resolve(new Response("[]"));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary, { release_year: "2025" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("year-2025"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    });
    expect(await screen.findByRole("heading", { name: "二零二五电影" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("年度精选暂时无法加载");
    expect(screen.queryByRole("heading", { name: "二零二五电影" })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("year-2025"));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "二零二五电影" })).toBeInTheDocument();
    // 2025 电影已缓存，切回时不应再请求该组合。
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input) === "/api/top-media?type=movie&year=2025"),
    ).toHaveLength(1);
  });

  it("过期的年度精选响应不会覆盖当前年份视图", async () => {
    let resolve2024: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => {
      const url = String(input);
      if (url.includes("year=2024")) {
        // 故意不在 abort 时拒绝，模拟已发出的响应在切换年份后才到达。
        return new Promise((resolve) => {
          resolve2024 = resolve;
        });
      }
      if (url.includes("year=2025")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: "m2025",
                title: "二零二五电影",
                date: "2025-01-01",
                rating: 9,
                genres: [],
                languages: [],
                cover_url: "/2025.jpg",
                type: "movies",
                dbType: "movie",
                status: "watched",
              },
            ]),
          ),
        );
      }
      return Promise.resolve(new Response("[]"));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary, { release_year: "2025" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("year-2025"));
    });
    expect(await screen.findByRole("heading", { name: "二零二五电影" })).toBeInTheDocument();

    await act(async () => {
      resolve2024?.(
        new Response(
          JSON.stringify([
            {
              id: "m2024",
              title: "二零二四电影",
              date: "2024-01-01",
              rating: 8,
              genres: [],
              languages: [],
              cover_url: "/2024.jpg",
              type: "movies",
              dbType: "movie",
              status: "watched",
            },
          ]),
        ),
      );
    });

    expect(screen.getByRole("heading", { name: "二零二五电影" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "二零二四电影" })).not.toBeInTheDocument();
  });

  it("把在看放在看板最上方，没有条目时不占位", () => {
    const { rerender } = render(
      <HomeDashboard
        summary={[]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );
    expect(screen.queryByRole("heading", { name: "在看" })).not.toBeInTheDocument();

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
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
        continueWatching={[item]}
      />,
    );
    expect(screen.getByRole("heading", { name: "在看" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /跑男/ })).toHaveAttribute("href", "/shows/show-1");
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
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
        upcoming={[futureUpcoming]}
        continueWatching={[watchingItem]}
        renderedOn="2026-09-27"
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

  it("放映单始终先放倒计时，再放在看", () => {
    const { container } = renderDashboard();
    expect(leadBlockOrder(container)).toEqual(["upcoming", "continue"]);
    const heading = screen.getByRole("heading", { name: "在看" });
    const upcoming = screen.getByTestId("upcoming");
    expect(upcoming.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("缓存池非空但过滤后无展台时，仍为固定导航栏留出顶部间距", () => {
    const { container } = render(
      <HomeDashboard
        summary={[]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
        upcoming={[pastUpcoming]}
        renderedOn="2026-09-27"
      />,
    );
    expect(screen.queryByTestId("upcoming")).not.toBeInTheDocument();
    const content = container.querySelector(".container");
    expect(content?.className).toMatch(/\bpt-20\b/);
    expect(content?.className).not.toMatch(/\bpt-2\b/);
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
            total_albums: 5,
            total_tracks: 42,
            total_books: 9,
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
            total_albums: 2,
            total_tracks: 8,
            total_books: 1,
          } as Summary,
        ]}
        topMovies={[]}
        topSeries={[]}
        topAlbums={[]}
        topBooks={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    expect(screen.queryByRole("region", { name: "全时段统计" })).not.toBeInTheDocument();
    const intro = screen.getByRole("region", { name: "媒体全景" });
    expect(intro).toHaveTextContent("全时段档案");
    expect(intro).toHaveTextContent("67");
    expect(intro).toHaveTextContent("电影");
    expect(intro).toHaveTextContent("电视节目");
    expect(intro).toHaveTextContent("音乐");
    expect(intro).toHaveTextContent("图书");
    expect(intro).not.toHaveTextContent("总计");
    // 页头「音乐」按曲目数，不按专辑数；精确值在 aria-label／title。
    const musicStat = Array.from(intro.querySelectorAll("dt")).find((dt) => dt.textContent === "音乐");
    expect(musicStat?.parentElement).toHaveTextContent("42");
    expect(musicStat?.parentElement).not.toHaveTextContent("5");
    expect(screen.getByLabelText("42")).toHaveAttribute("title", "42");
    expect(screen.getByLabelText("67")).toHaveTextContent("67");

    await act(async () => {
      fireEvent.click(screen.getByText("year-2024"));
    });

    expect(screen.queryByRole("region", { name: "全时段统计" })).not.toBeInTheDocument();
    expect(intro).toHaveTextContent("2024 年度档案");
    expect(intro).toHaveTextContent("3");
    expect(intro).not.toHaveTextContent("67");
    const musicStatYear = Array.from(intro.querySelectorAll("dt")).find((dt) => dt.textContent === "音乐");
    expect(musicStatYear?.parentElement).toHaveTextContent("8");
    expect(screen.getByLabelText("8")).toHaveAttribute("title", "8");
  });
});
