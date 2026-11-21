import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodeInfo, Media, SeasonInfo } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/lib/functions/cached-media", () => ({
  getCachedMediaById: vi.fn(),
  getCachedSeasonsBySeriesId: vi.fn(),
  getCachedSeasonEpisodes: vi.fn(),
  getCachedSeasonNextEpisodeNumber: vi.fn(),
}));

import SeasonPage, {
  generateMetadata,
  generateStaticParams,
  revalidate,
} from "@/app/shows/[id]/seasons/[seasonId]/page";
import {
  getCachedMediaById,
  getCachedSeasonEpisodes,
  getCachedSeasonNextEpisodeNumber,
  getCachedSeasonsBySeriesId,
} from "@/lib/functions/cached-media";
import { SITE_URL } from "@/lib/site";

const seriesId = "50000000-0000-4000-8000-000000000002";
const seasonId = "50000000-0000-4000-8000-000000000003";
const seasonTwoId = "50000000-0000-4000-8000-000000000004";
const season: SeasonInfo = {
  id: seasonId,
  seasonNumber: 1,
  title: "城市信号 第一季",
  coverUrl: "",
  episodeCount: 2,
  watchedEpisodeCount: 1,
  summary: "第一季简介",
};
const seasonTwo: SeasonInfo = {
  id: seasonTwoId,
  seasonNumber: 2,
  title: "城市信号 第二季",
  coverUrl: "",
  episodeCount: 3,
  watchedEpisodeCount: 0,
  summary: "",
};

/** 准备一季的默认数据，供页面只读取第 1 页。 */
function mockSeason(seasons: SeasonInfo[] = [season]) {
  vi.mocked(getCachedMediaById).mockResolvedValue({
    id: seriesId,
    title: "城市信号",
    type: "shows",
    cover_url: "",
  } as Media);
  vi.mocked(getCachedSeasonsBySeriesId).mockResolvedValue(seasons);
  vi.mocked(getCachedSeasonEpisodes).mockResolvedValue({
    season,
    episodes: [
      {
        id: "ep-1",
        episodeNumber: 1,
        title: "启程",
        summary: "",
        releaseDate: null,
        runtime: null,
        status: "watched",
        rating: null,
      },
      {
        id: "ep-2",
        episodeNumber: 2,
        title: "回声",
        summary: "",
        releaseDate: "2024-02-02",
        runtime: null,
        status: null,
        rating: null,
      },
    ],
    total: 2,
    watchedCount: 1,
    totalRuntime: 48,
    averageRating: 8,
  });
  vi.mocked(getCachedSeasonNextEpisodeNumber).mockResolvedValue(2);
}

describe("SeasonPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.mocked(getCachedMediaById).mockReset();
    vi.mocked(getCachedSeasonsBySeriesId).mockReset();
    vi.mocked(getCachedSeasonEpisodes).mockReset();
    vi.mocked(getCachedSeasonNextEpisodeNumber).mockReset();
    season.summary = "第一季简介";
    mockSeason();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("按需静态生成且不定时重建，构建时不枚举季", () => {
    expect(revalidate).toBe(false);
    expect(generateStaticParams()).toEqual([]);
  });

  it("只渲染默认单集页，规范地址不包含分页或筛选", async () => {
    const { container } = render(await SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) }));
    expect(screen.getByRole("heading", { level: 1, name: "城市信号 第一季" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "启程" })).toBeInTheDocument();
    expect(screen.getByText("下一集")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 1, 20, "all", "asc");
    expect(getCachedSeasonNextEpisodeNumber).toHaveBeenCalledWith(seriesId, seasonId);

    const metadata = await generateMetadata({ params: Promise.resolve({ id: seriesId, seasonId }) });
    expect(metadata.alternates?.canonical).toBe(`/shows/${seriesId}/seasons/${seasonId}`);
    expect(metadata.title).toBe("城市信号 · 城市信号 第一季");
    expect(getCachedSeasonEpisodes).toHaveBeenCalledTimes(1);

    const script = container.querySelector('script[type="application/ld+json"]');
    const jsonLd = JSON.parse(script?.textContent ?? "");
    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "TVSeason",
      name: "城市信号 第一季",
      seasonNumber: 1,
      numberOfEpisodes: 2,
      partOfSeries: { "@type": "TVSeries", name: "城市信号", url: `${SITE_URL}/shows/${seriesId}` },
    });
    expect(jsonLd.episode).toEqual([
      { "@type": "TVEpisode", episodeNumber: 1, name: "启程" },
      { "@type": "TVEpisode", episodeNumber: 2, name: "回声", datePublished: "2024-02-02" },
    ]);
  });

  it("结构化数据收录未筛选的全部单集，页面仍只显示默认第一页", async () => {
    const episodes: EpisodeInfo[] = Array.from({ length: 101 }, (_, index) => ({
      id: `ep-${index + 1}`,
      episodeNumber: index + 1,
      title: `第 ${index + 1} 集`,
      summary: "",
      releaseDate: index === 100 ? "2024-12-31" : null,
      runtime: null,
      status: null,
      rating: null,
    }));
    const fullSeason = { ...season, episodeCount: episodes.length };
    vi.mocked(getCachedSeasonEpisodes).mockImplementation(async (_seriesId, _seasonId, page, pageSize) => {
      const start = (page - 1) * pageSize;
      return {
        season: fullSeason,
        episodes: episodes.slice(start, start + pageSize),
        total: episodes.length,
        watchedCount: 1,
        totalRuntime: 48,
        averageRating: 8,
      };
    });

    const { container } = render(await SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) }));
    const episodeHeadings = screen
      .getAllByRole("heading", { level: 2 })
      .filter((heading) => heading.textContent?.startsWith("第 "));
    expect(episodeHeadings).toHaveLength(20);
    expect(screen.queryByRole("heading", { level: 2, name: "第 101 集" })).not.toBeInTheDocument();

    const jsonLd = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "");
    expect(jsonLd.numberOfEpisodes).toBe(101);
    expect(jsonLd.episode).toHaveLength(101);
    expect(jsonLd.episode[0]).toEqual({ "@type": "TVEpisode", episodeNumber: 1, name: "第 1 集" });
    expect(jsonLd.episode[100]).toEqual({
      "@type": "TVEpisode",
      episodeNumber: 101,
      name: "第 101 集",
      datePublished: "2024-12-31",
    });
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 1, 20, "all", "asc");
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 1, 100, "all", "asc");
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 2, 100, "all", "asc");
  });

  it("无海报头部占满宽度，统计收成一行，长简介可展开", async () => {
    season.summary = "本季从摸索走到定型。".repeat(10);
    const { container } = render(await SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) }));
    expect(container.querySelector("header")).toHaveClass("rounded-3xl", "min-w-0", "px-5");
    expect(container.querySelector("[data-poster]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "城市信号 第一季" })).toHaveClass(
      "text-2xl",
      "sm:text-4xl",
      "lg:text-5xl",
    );
    expect(screen.getByRole("region", { name: "本季统计" })).toHaveClass("whitespace-nowrap", "lg:grid");
    expect(screen.getByText(/本季从摸索走到定型/)).toHaveClass("max-w-[70ch]", "line-clamp-4");
    expect(screen.getByRole("heading", { level: 2, name: "本季简介" })).toBeInTheDocument();
  });

  it("多季时渲染全宽季度 tab 条，单季不显示", async () => {
    mockSeason([season, seasonTwo]);
    const { rerender } = render(await SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) }));
    const tablist = screen.getByRole("tablist", { name: "选择季度" });
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "第 1 季", current: "page" })).toHaveAttribute(
      "href",
      `/shows/${seriesId}/seasons/${seasonId}`,
    );
    expect(screen.getByRole("tab", { name: "第 2 季" })).toHaveAttribute(
      "href",
      `/shows/${seriesId}/seasons/${seasonTwoId}`,
    );

    mockSeason([season]);
    rerender(await SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) }));
    expect(screen.queryByRole("tablist", { name: "选择季度" })).not.toBeInTheDocument();
  });

  it("没有简介时不渲染简介区", async () => {
    season.summary = "";
    render(await SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) }));
    expect(screen.queryByRole("heading", { level: 2, name: "本季简介" })).not.toBeInTheDocument();
  });

  it("季不存在时返回未找到", async () => {
    vi.mocked(getCachedSeasonEpisodes).mockResolvedValue(null);
    await expect(SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) })).rejects.toThrow("NOT_FOUND");
  });
});
