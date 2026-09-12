import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSeasonEpisodes } from "@/lib/functions/media-repo";
import type { EpisodeInfo } from "@/lib/types";
import type { Metadata } from "next";
import { getCachedMediaById, getCachedSeasonsBySeriesId } from "@/lib/functions/cached-media";
import { buildSeasonMetadata } from "@/lib/seo/media";

export const revalidate = 60;

const PAGE_SIZE = 10;
type StatusFilter = "all" | "watched" | "unwatched";
type EpisodeOrder = "asc" | "desc";

/** 并行读取电视剧与季摘要，找到目标季后生成元数据；缺失时返回未找到标题。 */
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

/** 渲染单集卡片，展示剧集封面、集数、标题、观看状态、上映日期和简介。 */
function EpisodeCard({ episode }: { episode: EpisodeInfo }) {
  const watched = episode.status === "watched";

  return (
    <article className="surface-card interactive-card group flex flex-col overflow-hidden rounded-2xl sm:h-64 sm:flex-row">
      <div className="image-overlay relative aspect-video w-full shrink-0 overflow-hidden sm:aspect-auto sm:h-full sm:w-80 md:w-96">
        {episode.coverUrl ? (
          <Image
            src={episode.coverUrl}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(min-width: 768px) 384px, (min-width: 640px) 320px, calc(100vw - 48px)"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20">
            <span className="i-material-symbols-image-outline-rounded inline-block size-8" aria-hidden="true" />
          </div>
        )}
        <span className="image-label absolute left-2 top-2 rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-white backdrop-blur-md">
          EP {episode.episodeNumber}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 font-bold text-white/90 transition-colors group-hover:text-red-400" title={episode.title}>
              {episode.title}
            </h2>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            watched ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400" : "surface-muted border-white/10 text-white/60"
          }`}>
            {watched ? <span className="i-material-symbols-check-circle-rounded inline-block size-3" aria-hidden="true" /> : <span className="i-material-symbols-visibility-rounded inline-block size-3" aria-hidden="true" />}
            {watched ? "已看" : "未看"}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
          {episode.releaseDate && <span className="flex items-center gap-1"><span className="i-material-symbols-calendar-today-rounded inline-block size-3" aria-hidden="true" />{episode.releaseDate}</span>}
          {episode.runtime && <span className="flex items-center gap-1"><span className="i-material-symbols-schedule-rounded inline-block size-3" aria-hidden="true" />{episode.runtime} 分钟</span>}
          {episode.rating !== null && <span className="flex items-center gap-1 text-amber-400"><span className="i-material-symbols-star-rounded inline-block size-3 text-amber-400" aria-hidden="true" />{episode.rating.toFixed(1)}</span>}
        </div>

        {episode.summary ? (
          <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-white/60 sm:line-clamp-5 md:line-clamp-6" title={episode.summary}>
            {episode.summary}
          </p>
        ) : <p className="mt-3 text-sm text-white/35">暂无简介。</p>}
      </div>
    </article>
  );
}

/** 生成最多五个连续页码，并在列表首尾调整窗口。 */
function pageNumbers(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, /* 把分页窗口索引转换为页码。 */ (_, index) => start + index);
}

/** 校验季页面的分页和筛选输入，并行加载详情、剧集与季列表，渲染统计和翻页导航。 */
export default async function SeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; seasonId: string }>;
  searchParams: Promise<{ page?: string; status?: string; order?: string }>;
}) {
  const [{ id, seasonId }, query] = await Promise.all([params, searchParams]);
  const requestedPage = Number(query.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const status: StatusFilter = query.status === "watched" || query.status === "unwatched" ? query.status : "all";
  const order: EpisodeOrder = query.order === "desc" ? "desc" : "asc";
  const [series, seasonData, seasons] = await Promise.all([
    getCachedMediaById(id),
    getSeasonEpisodes(id, seasonId, page, PAGE_SIZE, status, order),
    getCachedSeasonsBySeriesId(id),
  ]);

  if (!series || !seasonData) notFound();

  const totalPages = Math.max(1, Math.ceil(seasonData.total / PAGE_SIZE));
  /** 将当前分页条件与传入覆盖值合并为查询串，省略第一页、全部状态和升序默认值。 */
  const queryString = (values: { page?: number; status?: StatusFilter; order?: EpisodeOrder } = {}) => {
    const nextStatus = values.status ?? status;
    const nextOrder = values.order ?? order;
    const nextPage = values.page ?? page;
    const params = new URLSearchParams();
    if (nextPage > 1) params.set("page", String(nextPage));
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextOrder !== "asc") params.set("order", nextOrder);
    const value = params.toString();
    return value ? `?${value}` : "";
  };
  /** 为当前季生成包含指定分页或筛选条件的地址。 */
  const seasonHref = (values: { page?: number; status?: StatusFilter; order?: EpisodeOrder } = {}) =>
    `/series/${id}/seasons/${seasonId}${queryString(values)}`;

  if (page > totalPages) redirect(seasonHref({ page: totalPages }));

  const currentSeasonIndex = seasons.findIndex(/* 查找当前季在季列表中的位置，供相邻季导航使用。 */ (season) => season.id === seasonId);
  const previousSeason = currentSeasonIndex > 0 ? seasons[currentSeasonIndex - 1] : null;
  const nextSeason = currentSeasonIndex >= 0 && currentSeasonIndex < seasons.length - 1 ? seasons[currentSeasonIndex + 1] : null;
  const watchedPercent = seasonData.season.episodeCount > 0
    ? Math.round((seasonData.watchedCount / seasonData.season.episodeCount) * 100)
    : 0;

  return (
    <div className="min-h-screen pb-16 pt-24 text-white/90">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link href={`/series/${id}`} className="surface-muted interactive-control mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 backdrop-blur-xl">
          <span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" /> 返回《{series.title}》
        </Link>

        <header className="surface-panel relative mb-6 overflow-hidden rounded-3xl p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            <div className="image-overlay relative aspect-2/3 w-full max-w-72 shrink-0 self-center overflow-hidden rounded-2xl border border-white/15 shadow-[0_12px_35px_rgba(0,0,0,0.35)] lg:w-72 lg:self-start">
              {seasonData.season.coverUrl ? (
                <Image src={seasonData.season.coverUrl} alt={`${seasonData.season.title} 海报`} fill priority className="object-cover" sizes="(max-width: 362px) calc(100vw - 74px), 288px" />
              ) : (
                <div className="flex h-full items-center justify-center text-white/30"><span className="i-material-symbols-image-outline-rounded inline-block size-9" aria-hidden="true" /></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-sm font-medium tracking-widest text-red-400">{series.title} · 第 {seasonData.season.seasonNumber} 季</p>
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div>
                  <h1 className="text-3xl font-bold text-white md:text-5xl">{seasonData.season.title}</h1>
                  <p className="mt-3 text-sm text-white/50">
                    {seasonData.season.releaseYearRange ? `${seasonData.season.releaseYearRange} · ` : ""}{seasonData.season.episodeCount} 集
                  </p>
                </div>
                <div className="flex items-center gap-2">
              {previousSeason && <Link href={`/series/${id}/seasons/${previousSeason.id}`} className="surface-recessed interactive-control rounded-xl border border-white/10 p-2.5 text-white/60" aria-label={`上一季：第 ${previousSeason.seasonNumber} 季`}><span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" /></Link>}
              <div className="surface-recessed flex max-w-72 gap-1 overflow-x-auto rounded-xl border border-white/10 p-1">
                {seasons.map(/* 为一个季渲染切换链接，并突出当前季。 */ (season) => (
                  <Link key={season.id} href={`/series/${id}/seasons/${season.id}`} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition-colors ${season.id === seasonId ? "surface-active border border-red-400/40 font-bold text-red-400 shadow-[0_4px_10px_rgba(248,113,113,0.2)]" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>
                    第 {season.seasonNumber} 季
                  </Link>
                ))}
              </div>
              {nextSeason && <Link href={`/series/${id}/seasons/${nextSeason.id}`} className="surface-recessed interactive-control rounded-xl border border-white/10 p-2.5 text-white/60" aria-label={`下一季：第 ${nextSeason.seasonNumber} 季`}><span className="i-material-symbols-chevron-right-rounded inline-block size-4" aria-hidden="true" /></Link>}
                </div>
              </div>
              {seasonData.season.summary && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white/60">本季简介</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-white/70 md:text-base">
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
            ["总时长", `${Math.round(seasonData.totalRuntime / 60)} 小时`],
            ["平均评分", seasonData.averageRating === null ? "—" : seasonData.averageRating.toFixed(1)],
          ].map(/* 将整季的一项统计渲染为标签和数值。 */ ([label, value]) => (
            <div key={label} className="surface-muted rounded-2xl border border-white/10 p-4 backdrop-blur-xl">
              <p className="text-xs text-white/60">{label}</p>
              <p className="mt-2 font-mono text-xl text-white">{value}</p>
            </div>
          ))}
        </section>

        <div className="surface-overlay sticky top-20 z-20 mb-6 flex flex-col justify-between gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="i-material-symbols-filter-list-rounded ml-1 size-4 shrink-0 text-white/60 inline-block" aria-hidden="true" />
            {(["all", "watched", "unwatched"] as const).map(/* 生成观看状态筛选链接，切换状态时回到第一页。 */ (value) => (
              <Link key={value} href={seasonHref({ page: 1, status: value })} className={`shrink-0 rounded-lg border px-4 py-1.5 text-[13px] backdrop-blur-2xl transition-all duration-300 ${status === value ? "surface-active border-red-400/40 font-bold text-red-400 shadow-[0_4px_10px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]" : "surface-muted border-white/10 text-white/70 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:border-white/20 hover:bg-white/10 hover:text-white hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"}`}>
                {{ all: "全部", watched: "已看", unwatched: "未看" }[value]}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/60">集数</span>
            <Link href={seasonHref({ page: 1, order: order === "asc" ? "desc" : "asc" })} className="surface-active rounded-lg border border-red-400/40 px-4 py-1.5 text-[13px] font-bold text-red-400 shadow-[0_4px_10px_rgba(248,113,113,0.2)] backdrop-blur-2xl drop-shadow-[0_0_3px_rgba(248,113,113,0.3)] transition-all duration-300 hover:bg-red-500/25">
              {order === "asc" ? "升序 ↑" : "降序 ↓"}
            </Link>
            <span className="ml-auto text-white/60 sm:ml-2">{seasonData.total} 集</span>
          </div>
        </div>

        {seasonData.episodes.length > 0 ? (
          <div className="space-y-3">
            {seasonData.episodes.map(/* 将当前页的一集数据渲染为剧集卡片。 */ (episode) => <EpisodeCard key={episode.id} episode={episode} />)}
          </div>
        ) : (
          <div className="surface-muted rounded-2xl border border-white/10 py-20 text-center text-white/60">当前筛选下暂无剧集</div>
        )}

        {totalPages > 1 && (
          <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="剧集分页">
            {page > 1 && <Link href={seasonHref({ page: page - 1 })} className="surface-muted interactive-control rounded-xl border border-white/10 p-2.5 text-white/60" aria-label="上一页"><span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" /></Link>}
            {pageNumbers(page, totalPages).map(/* 生成保留当前筛选条件的页码链接，并标记当前页。 */ (pageNumber) => (
              <Link key={pageNumber} href={seasonHref({ page: pageNumber })} className={`min-w-10 rounded-xl border px-3 py-2 text-center text-sm ${pageNumber === page ? "surface-active border-red-400/40 text-red-400 font-bold shadow-[0_4px_10px_rgba(248,113,113,0.2)]" : "surface-muted border-white/10 text-white/70 hover:bg-white/10 hover:text-white"}`}>
                {pageNumber}
              </Link>
            ))}
            {page < totalPages && <Link href={seasonHref({ page: page + 1 })} className="surface-muted interactive-control rounded-xl border border-white/10 p-2.5 text-white/60" aria-label="下一页"><span className="i-material-symbols-chevron-right-rounded inline-block size-4" aria-hidden="true" /></Link>}
          </nav>
        )}
      </div>
    </div>
  );
}
