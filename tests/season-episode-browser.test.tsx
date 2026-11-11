import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodeInfo } from "@/lib/types";

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children, scroll, onClick, ...props }: { href: string; children: ReactNode; scroll?: boolean; onClick?: (event: MouseEvent) => void }) => (
    <a href={href} data-scroll={scroll === false ? "false" : "true"} onClick={onClick} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ replace: navigation.replace }),
}));

import SeasonEpisodeBrowser from "@/components/SeasonEpisodeBrowser";

const basePath = "/shows/series/seasons/season";
const episodes: EpisodeInfo[] = [
  { id: "ep-1", episodeNumber: 1, title: "启程", alternateTitle: "Departure", summary: "出发去看城市。\n第二行还在。\n第三行默认收起。", releaseDate: null, runtime: 24, status: "watched", rating: 8 },
  { id: "ep-2", episodeNumber: 2, title: "回声", alternateTitle: "回声", summary: "", releaseDate: "2024-02-01", runtime: null, status: "want_to_watch", rating: null },
];

/** 用固定首屏单集渲染季页浏览器。 */
function renderBrowser(total = episodes.length, nextEpisodeNumber: number | null = 2) {
  return render(
    <SeasonEpisodeBrowser
      basePath={basePath}
      seriesId="50000000-0000-4000-8000-000000000002"
      seasonId="50000000-0000-4000-8000-000000000003"
      initialEpisodes={episodes}
      initialTotal={total}
      initialNextEpisodeNumber={nextEpisodeNumber}
    />,
  );
}

describe("SeasonEpisodeBrowser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("默认第一页直接展示服务端单集，不请求接口，并保留可分享的筛选地址", async () => {
    renderBrowser(25);
    expect(screen.getByRole("heading", { level: 2, name: "启程" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "回声" })).toBeInTheDocument();
    expect(screen.getByText("25 集")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "未看" })).toHaveAttribute("href", `${basePath}?status=unwatched`);
    expect(screen.getByRole("link", { name: "升序 ↑" })).toHaveAttribute("href", `${basePath}?order=desc`);
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("href", `${basePath}?page=2`);
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("data-scroll", "false");
    await waitFor(() => {
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it("用大号集数、别名和可展开简介代替剧照，并标出下一集", () => {
    renderBrowser();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.queryByText("回声", { selector: "p" })).not.toBeInTheDocument();
    const list = within(screen.getByRole("region", { name: "单集列表" }));
    expect(list.getByText("24 分钟")).toBeInTheDocument();
    expect(list.getByText("8.0")).toBeInTheDocument();
    expect(list.getByText("2024-02-01")).toBeInTheDocument();
    expect(list.getByText("已看")).toBeInTheDocument();
    expect(list.getByText("未看")).toBeInTheDocument();
    expect(list.getByText("下一集")).toBeInTheDocument();

    const watchedNumber = screen.getByText("1");
    expect(watchedNumber).toHaveClass("text-[var(--accent-hover)]");
    const nextRow = screen.getByRole("heading", { name: "回声" }).closest("article");
    expect(nextRow).toHaveClass("episode-next");
    expect(nextRow?.querySelector(".font-mono")).not.toHaveClass("text-[var(--accent-hover)]");

    const details = screen.getByRole("heading", { name: "启程" }).closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("展开简介 ▾")).toBeInTheDocument();
    fireEvent.click(details!.querySelector("summary")!);
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("收起 ▴")).toBeVisible();
  });

  it("打开带筛选的地址后请求对应列表，并替换超出末页的页码", async () => {
    navigation.search = "status=unwatched&page=9";
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({
      episodes: [episodes[1]],
      total: 1,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    renderBrowser();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "回声" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { level: 2, name: "启程" })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/shows/50000000-0000-4000-8000-000000000002/seasons/50000000-0000-4000-8000-000000000003/episodes?page=9&status=unwatched",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(`${basePath}?status=unwatched`, { scroll: false });
    });
  });

  it("翻页时停在原滚动位置，并用骨架行垫住列表高度", async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 3214 });
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}) as Promise<Response>);

    const view = renderBrowser(25);
    const list = screen.getByTestId("episode-list");
    const anchor = screen.getByTestId("episode-list-anchor");
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({
      height: 1800, width: 800, top: 200, bottom: 2000, left: 0, right: 800, x: 0, y: 200, toJSON() { return {}; },
    });
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      height: 0, width: 800, top: -2100, bottom: -2100, left: 0, right: 800, x: 0, y: -2100, toJSON() { return {}; },
    });

    fireEvent.click(screen.getByRole("link", { name: "2" }));
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    navigation.search = "page=2";
    view.rerender(
      <SeasonEpisodeBrowser
        basePath={basePath}
        seriesId="50000000-0000-4000-8000-000000000002"
        seasonId="50000000-0000-4000-8000-000000000003"
        initialEpisodes={episodes}
        initialTotal={25}
        initialNextEpisodeNumber={2}
      />,
    );

    const status = await screen.findByRole("status", { name: "正在加载单集" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(within(status).getAllByTestId("episode-skeleton")).toHaveLength(2);
    expect(list).toHaveStyle({ minHeight: "1800px" });
    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({ top: 1034, behavior: "auto" });
    });
    expect(screen.queryByText("当前筛选下暂无单集")).not.toBeInTheDocument();
  });

  it("接口失败时保留当前地址并提示重试", async () => {
    navigation.search = "order=desc";
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ error: "nope" }), { status: 503 }));
    renderBrowser();
    expect(await screen.findByRole("alert")).toHaveTextContent("单集列表暂时无法加载，请稍后重试。");
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "降序 ↓" })).toHaveAttribute("href", basePath);
  });
});
