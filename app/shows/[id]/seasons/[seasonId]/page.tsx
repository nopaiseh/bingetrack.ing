import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackLink } from "@/components/MediaBackLink";
import SeasonEpisodeBrowser from "@/components/SeasonEpisodeBrowser";
import { formatRuntime } from "@/lib/format-runtime";
import { getCachedMediaById, getCachedSeasonEpisodes, getCachedSeasonsBySeriesId } from "@/lib/functions/cached-media";
import { buildSeasonJsonLd, buildSeasonMetadata, serializeJsonLd } from "@/lib/seo/media";
import { SEASON_EPISODE_PAGE_SIZE } from "@/lib/season-browse";
import type { EpisodeInfo, SeasonEpisodePage } from "@/lib/types";

// 单集分页接口单次最多 100 条。结构化数据按这个上限取未筛选升序结果，页数封顶以免异常集数连续查询。
const JSON_LD_EPISODE_PAGE_SIZE = 100;
const JSON_LD_EPISODE_PAGE_LIMIT = 10;

// 默认季页（第 1 页、全部、升序）按需静态生成，24 小时再验证；保存条目时沿用媒体标签即时失效。
// 不读取 searchParams，否则整页会变成每次请求都动态渲染。分页和筛选留在客户端，地址仍使用原来的查询串。
export const revalidate = 86400;

/** 构建时不枚举季 ID，季页由首次访问触发按需生成。 */
export function generateStaticParams() { return []; }

/** 并行读取电视节目与季摘要，找到目标季后生成元数据；缺失时返回未找到标题。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}): Promise<Metadata> {
  const { id, seasonId } = await params;
  const [series, seasons] = await Promise.all([
    getCachedMediaById(id),
    getCachedSeasonsBySeriesId(id),
  ]);
  const season = seasons.find(/* 按季 ID 查找目标季。 */ (item) => item.id === seasonId);
  if (!series || !season) return { title: "季度未找到" };
  return buildSeasonMetadata(series, season);
}

/**
 * 读取未筛选、升序的全部单集，供静态页的 TVSeason 使用。
 * 默认第一页已经包含整季时直接复用，不再额外查询。
 */
async function loadEpisodesForJsonLd(
  seriesId: string,
  seasonId: string,
  seasonPage: SeasonEpisodePage,
): Promise<EpisodeInfo[]> {
  const total = seasonPage.season.episodeCount;
  if (seasonPage.episodes.length >= total) return seasonPage.episodes;

  const pageCount = Math.min(
    JSON_LD_EPISODE_PAGE_LIMIT,
    Math.max(1, Math.ceil(total / JSON_LD_EPISODE_PAGE_SIZE)),
  );
  const pages = await Promise.all(Array.from({ length: pageCount }, (_, index) =>
    getCachedSeasonEpisodes(seriesId, seasonId, index + 1, JSON_LD_EPISODE_PAGE_SIZE, "all", "asc"),
  ));
  const episodes = pages.flatMap(/* 跳过缺失页，保留已取到的单集。 */ (page) => page?.episodes ?? []);
  return episodes.length > 0 ? episodes : seasonPage.episodes;
}

/** 加载默认单集页、季摘要和相邻季，渲染海报、统计，并把筛选与翻页交给客户端。 */
export default async function SeasonPage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}) {
  const { id, seasonId } = await params;
  const [series, seasonData, seasons] = await Promise.all([
    getCachedMediaById(id),
    getCachedSeasonEpisodes(id, seasonId, 1, SEASON_EPISODE_PAGE_SIZE, "all", "asc"),
    getCachedSeasonsBySeriesId(id),
  ]);

  if (!series || !seasonData) notFound();

  const currentSeasonIndex = seasons.findIndex(/* 查找当前季在季列表中的位置，供相邻季导航使用。 */ (season) => season.id === seasonId);
  const previousSeason = currentSeasonIndex > 0 ? seasons[currentSeasonIndex - 1] : null;
  const nextSeason = currentSeasonIndex >= 0 && currentSeasonIndex < seasons.length - 1 ? seasons[currentSeasonIndex + 1] : null;
  const watchedPercent = seasonData.season.episodeCount > 0
    ? Math.round((seasonData.watchedCount / seasonData.season.episodeCount) * 100)
    : 0;
  const basePath = `/shows/${id}/seasons/${seasonId}`;
  // 结构化数据来自静态默认页的未筛选单集。客户端改分页或筛选时不会改写这段脚本。
  const episodesForJsonLd = await loadEpisodesForJsonLd(id, seasonId, seasonData);
  const jsonLd = buildSeasonJsonLd(series, seasonData.season, episodesForJsonLd);

  return (
    <div className="min-h-screen pb-16 pt-24 text-fg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <BackLink href={`/shows/${id}`} label={`返回《${series.title}》`} />

        <header className="surface-panel relative mb-6 overflow-hidden rounded-3xl p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            <div className="image-overlay relative aspect-2/3 w-full max-w-72 shrink-0 self-center overflow-hidden rounded-2xl border border-white/15 shadow-[0_12px_35px_rgba(0,0,0,0.35)] lg:w-72 lg:self-start">
              {seasonData.season.coverUrl ? (
                <Image src={seasonData.season.coverUrl} alt={`${seasonData.season.title} 海报`} fill priority className="object-cover" sizes="(max-width: 362px) calc(100vw - 74px), 288px" />
              ) : (
                <div className="flex h-full items-center justify-center text-fg-faint"><span className="i-material-symbols-image-outline-rounded inline-block size-9" aria-hidden="true" /></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-sm font-medium tracking-widest text-[var(--accent-hover)]">{series.title} · 第 {seasonData.season.seasonNumber} 季</p>
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div>
                  <h1 className="font-serif-movie text-balance text-3xl font-bold tracking-tight bg-linear-to-b from-white via-white/95 to-white/75 bg-clip-text text-transparent sm:text-4xl lg:text-5xl">{seasonData.season.title}</h1>
                  <p className="mt-3 text-sm text-fg-subtle">
                    {seasonData.season.releaseYearRange ? `${seasonData.season.releaseYearRange} · ` : ""}{seasonData.season.episodeCount} 集
                  </p>
                </div>
                <div className="flex items-center gap-2">
              {previousSeason && <Link href={`/shows/${id}/seasons/${previousSeason.id}`} className="surface-recessed interactive-control rounded-xl border border-white/10 p-2.5 text-fg-muted" aria-label={`上一季：第 ${previousSeason.seasonNumber} 季`}><span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" /></Link>}
              <div className="surface-recessed flex max-w-72 gap-1 overflow-x-auto rounded-xl border border-white/10 p-1">
                {seasons.map(/* 为一个季渲染切换链接，并突出当前季。 */ (season) => (
                  <Link key={season.id} href={`/shows/${id}/seasons/${season.id}`} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition-colors ${season.id === seasonId ? "surface-active border border-[var(--accent-border)] font-bold text-[var(--accent-hover)] shadow-[0_4px_10px_var(--accent-glow-soft)]" : "text-fg-muted hover:bg-white/10 hover:text-white"}`}>
                    第 {season.seasonNumber} 季
                  </Link>
                ))}
              </div>
              {nextSeason && <Link href={`/shows/${id}/seasons/${nextSeason.id}`} className="surface-recessed interactive-control rounded-xl border border-white/10 p-2.5 text-fg-muted" aria-label={`下一季：第 ${nextSeason.seasonNumber} 季`}><span className="i-material-symbols-chevron-right-rounded inline-block size-4" aria-hidden="true" /></Link>}
                </div>
              </div>
              {seasonData.season.summary && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-fg-muted">本季简介</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-fg-secondary md:text-base">
                    {seasonData.season.summary}
                  </p>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="本季统计">
          {[
            ["观看进度", `${seasonData.watchedCount} / ${seasonData.season.episodeCount}`],
            ["完成比例", `${watchedPercent}%`],
            ["总时长", formatRuntime(seasonData.totalRuntime, true) ?? "0 分钟"],
            ["平均评分", seasonData.averageRating === null ? "—" : seasonData.averageRating.toFixed(1)],
          ].map(/* 将整季的一项统计渲染为标签和数值。 */ ([label, value]) => (
            <div key={label} className="surface-muted rounded-2xl border border-white/10 p-4 backdrop-blur-xl">
              <p className="text-xs text-fg-muted">{label}</p>
              <p className="mt-2 font-mono text-xl text-white">{value}</p>
            </div>
          ))}
        </section>

        <SeasonEpisodeBrowser
          basePath={basePath}
          seriesId={id}
          seasonId={seasonId}
          initialEpisodes={seasonData.episodes}
          initialTotal={seasonData.total}
        />
      </div>
    </div>
  );
}
