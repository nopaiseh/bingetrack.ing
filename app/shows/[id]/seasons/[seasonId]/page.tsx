import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackLink } from "@/components/MediaBackLink";
import ClampedCopy from "@/components/ClampedCopy";
import SeasonEpisodeBrowser from "@/components/SeasonEpisodeBrowser";
import { formatRuntime, parseRuntimeParts } from "@/lib/format-runtime";
import { getCachedMediaById, getCachedSeasonEpisodes, getCachedSeasonNextEpisodeNumber, getCachedSeasonsBySeriesId } from "@/lib/functions/cached-media";
import { buildSeasonJsonLd, buildSeasonMetadata, serializeJsonLd } from "@/lib/seo/media";
import { SEASON_EPISODE_PAGE_SIZE } from "@/lib/season-browse";
import type { EpisodeInfo, SeasonEpisodePage, SeasonInfo } from "@/lib/types";

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

/** 窄屏统计只保留天和小时，省掉空格，避免总时长把整行挤出屏幕。 */
function compactRuntime(runtime: number): string {
  const { days, hours, minutes } = parseRuntimeParts(runtime);
  if (days > 0) return `${days}天${hours > 0 ? `${hours}小时` : ""}`;
  if (hours > 0) return `${hours}小时${minutes > 0 ? `${minutes}分` : ""}`;
  return `${minutes}分钟`;
}

/** 季与季之间的切换。窄屏跟在标题下方并拉通整行，宽屏靠到标题右侧。 */
function SeasonSwitcher({
  seriesId,
  seasonId,
  seasons,
  previousSeason,
  nextSeason,
}: {
  seriesId: string;
  seasonId: string;
  seasons: SeasonInfo[];
  previousSeason: SeasonInfo | null;
  nextSeason: SeasonInfo | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {previousSeason ? <Link href={`/shows/${seriesId}/seasons/${previousSeason.id}`} className="surface-recessed interactive-control rounded-xl border border-white/10 p-2.5 text-fg-muted" aria-label={`上一季：第 ${previousSeason.seasonNumber} 季`}><span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" /></Link> : null}
      <div className="surface-recessed flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 p-1 lg:max-w-72">
        {seasons.map(/* 为一个季渲染切换链接，并突出当前季。 */ (season) => (
          <Link key={season.id} href={`/shows/${seriesId}/seasons/${season.id}`} className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${season.id === seasonId ? "surface-active border border-[var(--accent-border)] font-bold text-[var(--accent-hover)] shadow-[0_4px_10px_var(--accent-glow-soft)]" : "text-fg-muted hover:bg-white/10 hover:text-white"}`}>
            第 {season.seasonNumber} 季
          </Link>
        ))}
      </div>
      {nextSeason ? <Link href={`/shows/${seriesId}/seasons/${nextSeason.id}`} className="surface-recessed interactive-control rounded-xl border border-white/10 p-2.5 text-fg-muted" aria-label={`下一季：第 ${nextSeason.seasonNumber} 季`}><span className="i-material-symbols-chevron-right-rounded inline-block size-4" aria-hidden="true" /></Link> : null}
    </div>
  );
}

/** 加载默认单集页、季摘要和相邻季，渲染海报、统计，并把筛选与翻页交给客户端。 */
export default async function SeasonPage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}) {
  const { id, seasonId } = await params;
  const [series, seasonData, seasons, nextEpisodeNumber] = await Promise.all([
    getCachedMediaById(id),
    getCachedSeasonEpisodes(id, seasonId, 1, SEASON_EPISODE_PAGE_SIZE, "all", "asc"),
    getCachedSeasonsBySeriesId(id),
    getCachedSeasonNextEpisodeNumber(id, seasonId),
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
          <div className="flex items-start gap-3.5 lg:gap-8">
            <div className="image-overlay relative aspect-2/3 w-20 shrink-0 self-start overflow-hidden rounded-xl border border-white/15 shadow-[0_12px_35px_rgba(0,0,0,0.35)] lg:w-72 lg:rounded-2xl" data-poster>
              {seasonData.season.coverUrl ? (
                <Image src={seasonData.season.coverUrl} alt={`${seasonData.season.title} 海报`} fill priority className="object-cover" sizes="(max-width: 1023px) 112px, 288px" />
              ) : (
                <div className="flex h-full items-center justify-center text-fg-faint"><span className="i-material-symbols-image-outline-rounded inline-block size-6 lg:size-9" aria-hidden="true" /></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-5">
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-medium tracking-widest text-[var(--accent-hover)] lg:mb-2 lg:text-sm">{series.title} · 第 {seasonData.season.seasonNumber} 季</p>
                  <h1 className="font-serif-movie break-words bg-linear-to-b from-white via-white/95 to-white/75 bg-clip-text text-2xl font-bold tracking-tight text-balance text-transparent sm:text-4xl lg:text-5xl">{seasonData.season.title}</h1>
                  <p className="mt-1.5 text-sm text-fg-subtle lg:mt-3">
                    {seasonData.season.releaseYearRange ? `${seasonData.season.releaseYearRange} · ` : ""}{seasonData.season.episodeCount} 集
                  </p>
                </div>
                <div className="max-lg:-ml-[calc(5rem+0.875rem)] max-lg:w-[calc(100%+5rem+0.875rem)]">
                  <SeasonSwitcher seriesId={id} seasonId={seasonId} seasons={seasons} previousSeason={previousSeason} nextSeason={nextSeason} />
                </div>
              </div>
              {seasonData.season.summary ? (
                <div className="mt-4 border-t border-white/10 pt-4 max-lg:-ml-[calc(5rem+0.875rem)] max-lg:w-[calc(100%+5rem+0.875rem)] lg:mt-6 lg:pt-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-fg-muted">本季简介</h2>
                  <div className="mt-2">
                    <ClampedCopy text={seasonData.season.summary} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="mb-6 flex items-baseline gap-x-3 overflow-x-auto text-sm whitespace-nowrap lg:grid lg:grid-cols-4 lg:gap-3 lg:overflow-visible lg:whitespace-normal" aria-label="本季统计">
          {([
            ["观看进度", "进度", `${seasonData.watchedCount} / ${seasonData.season.episodeCount}`, `${seasonData.watchedCount}/${seasonData.season.episodeCount}`],
            ["完成比例", "完成", `${watchedPercent}%`, `${watchedPercent}%`],
            ["总时长", "时长", formatRuntime(seasonData.totalRuntime, true) ?? "0 分钟", compactRuntime(seasonData.totalRuntime)],
            ["平均评分", "评分", seasonData.averageRating === null ? "—" : seasonData.averageRating.toFixed(1), seasonData.averageRating === null ? "—" : seasonData.averageRating.toFixed(1)],
          ] as const).map(/* 窄屏用短标签排成一行，宽屏保持四张统计卡片。 */ ([label, shortLabel, value, compactValue]) => (
            <div key={label} className="inline-flex shrink-0 items-baseline gap-1.5 lg:surface-muted lg:block lg:rounded-2xl lg:border lg:border-white/10 lg:p-4 lg:backdrop-blur-xl">
              <p className="text-xs text-fg-muted"><span className="lg:hidden">{shortLabel}</span><span className="hidden lg:inline">{label}</span></p>
              <p className="font-mono text-sm text-white lg:mt-2 lg:text-xl"><span className="lg:hidden">{compactValue}</span><span className="hidden lg:inline">{value}</span></p>
            </div>
          ))}
        </section>

        <SeasonEpisodeBrowser
          basePath={basePath}
          seriesId={id}
          seasonId={seasonId}
          initialEpisodes={seasonData.episodes}
          initialTotal={seasonData.total}
          initialNextEpisodeNumber={nextEpisodeNumber}
        />
      </div>
    </div>
  );
}
