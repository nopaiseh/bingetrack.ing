import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Media, SeasonInfo } from "@/lib/types";

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
    episodes: [{
      id: "ep-1",
      episodeNumber: 1,
      title: "启程",
      summary: "",
      coverUrl: "",
      releaseDate: null,
      runtime: null,
      status: "watched",
      rating: null,
    }],
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
    render(await SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) }));
    expect(screen.getByRole("heading", { level: 1, name: "城市信号 第一季" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "启程" })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(getCachedSeasonEpisodes).toHaveBeenCalledWith(seriesId, seasonId, 1, 10, "all", "asc");

    const metadata = await generateMetadata({ params: Promise.resolve({ id: seriesId, seasonId }) });
    expect(metadata.alternates?.canonical).toBe(`/shows/${seriesId}/seasons/${seasonId}`);
    expect(metadata.title).toBe("城市信号 · 城市信号 第一季");
  });

  it("季不存在时返回未找到", async () => {
    vi.mocked(getCachedSeasonEpisodes).mockResolvedValue(null);
    await expect(SeasonPage({ params: Promise.resolve({ id: seriesId, seasonId }) })).rejects.toThrow("NOT_FOUND");
  });
});
