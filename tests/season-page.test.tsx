import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodeInfo, Media, SeasonInfo } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/lib/functions/cached-media", () => ({
  getCachedMediaById: vi.fn(),
  getCachedSeasonsBySeriesId: vi.fn(),
  getCachedSeasonEpisodes: vi.fn(),
}));

import SeasonPage, { generateMetadata, generateStaticParams, revalidate } from "@/app/shows/[id]/seasons/[seasonId]/page";
import { getCachedMediaById, getCachedSeasonEpisodes, getCachedSeasonsBySeriesId } from "@/lib/functions/cached-media";
import { SITE_URL } from "@/lib/site";

const seriesId = "50000000-0000-4000-8000-000000000002";
const seasonId = "50000000-0000-4000-8000-000000000003";
const season: SeasonInfo = {
  id: seasonId,
  seasonNumber: 1,
  title: "城市信号 第一季",
  coverUrl: "",
  episodeCount: 2,
  watchedEpisodeCount: 1,
  summary: "第一季简介",
};

/** 准备一季的默认数据，供页面只读取第 1 页。 */
function mockSeason() {
  vi.mocked(getCachedMediaById).mockResolvedValue({ id: seriesId, title: "城市信号", type: "shows", cover_url: "" } as Media);
  vi.mocked(getCachedSeasonsBySeriesId).mockResolvedValue([season]);
  vi.mocked(getCachedSeasonEpisodes).mockResolvedValue({
    season,
    episodes: [
      {
        id: "ep-1",
        episodeNumber: 1,
        title: "启程",
        summary: "",
        coverUrl: "",
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
        coverUrl: "",
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
}

describe("SeasonPage", () => {
  beforeEach(() => {
    vi.mocked(getCachedMediaById).mockReset();
    vi.mocked(getCachedSeasonsBySeriesId).mockReset();
    vi.mocked(getCachedSeasonEpisodes).mockReset();
    mockSeason();
  });

  it("按 24 小时增量静态生成，构建时不枚举季", () => {
    expect(revalidate).toBe(86400);
    expect(generateStaticParams()).toEqual([]);
  });

  it("只渲染默认单集页，规范地址不包含分页或筛选", async () => {
    const { container } = render(await SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) }));
    expect(screen.getByRole("heading", { level: 1, name: "城市信号 第一季" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "启程" })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 1, 10, "all", "asc");

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
      coverUrl: "",
      releaseDate: index === 100 ? "2024-12-31" : null,
      runtime: null,
      status: null,
      rating: null,
    }));
    const fullSeason = { ...season, episodeCount: episodes.length };
    vi.mocked(getCachedSeasonEpisodes).mockImplementation(async (_seriesId, _seasonId, page, pageSize) => {
      const start = pageSize === 10 ? 0 : (page - 1) * pageSize;
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
    const episodeHeadings = screen.getAllByRole("heading", { level: 2 }).filter((heading) => heading.textContent?.startsWith("第 "));
    expect(episodeHeadings).toHaveLength(10);
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
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 1, 10, "all", "asc");
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 1, 100, "all", "asc");
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 2, 100, "all", "asc");
  });

  it("季不存在时返回未找到", async () => {
    vi.mocked(getCachedSeasonEpisodes).mockResolvedValue(null);
    await expect(SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) })).rejects.toThrow("NOT_FOUND");
  });
});
