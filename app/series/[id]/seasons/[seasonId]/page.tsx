import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ImageIcon,
  ListFilter,
  Star,
} from "lucide-react";
import { getMediaById, getSeasonEpisodes, getSeasonsBySeriesId } from "@/lib/functions/media-repo";
import type { EpisodeInfo } from "@/lib/types";

export const revalidate = 60;

const PAGE_SIZE = 10;
type StatusFilter = "all" | "watched" | "unwatched";
type EpisodeOrder = "asc" | "desc";

function EpisodeCard({ episode }: { episode: EpisodeInfo }) {
  const watched = episode.status === "watched";

  return (
    <article className="glass-card group flex flex-col overflow-hidden rounded-2xl transition-colors duration-300 hover:border-red-400/30 hover:bg-white/8 sm:min-h-64 sm:flex-row">
      <div className="relative aspect-video w-full shrink-0 bg-black/30 sm:aspect-auto sm:w-72 md:w-88">
        {episode.coverUrl ? (
          <Image
            src={episode.coverUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 352px, (min-width: 640px) 288px, calc(100vw - 48px)"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20">
            <ImageIcon className="size-8" aria-hidden="true" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-xs font-bold text-white backdrop-blur-md">
          EP {episode.episodeNumber}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 font-bold text-white/90 transition-colors group-hover:text-red-300">{episode.title}</h2>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            watched ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/45"
          }`}>
            {watched ? <CheckCircle className="size-3" /> : <Eye className="size-3" />}
            {watched ? "已看" : "未看"}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
          {episode.releaseDate && <span className="flex items-center gap-1"><CalendarDays className="size-3" />{episode.releaseDate}</span>}
          {episode.runtime && <span className="flex items-center gap-1"><Clock3 className="size-3" />{episode.runtime} 分钟</span>}
          {episode.rating !== null && <span className="flex items-center gap-1 text-amber-400"><Star className="size-3 fill-current" />{episode.rating.toFixed(1)}</span>}
        </div>

        {episode.summary ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/60">{episode.summary}</p>
        ) : <p className="mt-3 text-sm text-white/35">暂无简介。</p>}
      </div>
    </article>
  );
}

function pageNumbers(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

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
    getMediaById(id),
    getSeasonEpisodes(id, seasonId, page, PAGE_SIZE, status, order),
    getSeasonsBySeriesId(id),
  ]);

  if (!series || !seasonData) notFound();

  const totalPages = Math.max(1, Math.ceil(seasonData.total / PAGE_SIZE));
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
  const seasonHref = (values: { page?: number; status?: StatusFilter; order?: EpisodeOrder } = {}) =>
    `/series/${id}/seasons/${seasonId}${queryString(values)}`;

  if (page > totalPages) redirect(seasonHref({ page: totalPages }));

  const currentSeasonIndex = seasons.findIndex((season) => season.id === seasonId);
  const previousSeason = currentSeasonIndex > 0 ? seasons[currentSeasonIndex - 1] : null;
  const nextSeason = currentSeasonIndex >= 0 && currentSeasonIndex < seasons.length - 1 ? seasons[currentSeasonIndex + 1] : null;
  const watchedPercent = seasonData.season.episodeCount > 0
    ? Math.round((seasonData.watchedCount / seasonData.season.episodeCount) * 100)
    : 0;

  return (
    <div className="min-h-screen pb-16 pt-24 text-neutral-200">
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <Link href={`/series/${id}`} className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white">
          <ChevronLeft className="size-4" /> 返回《{series.title}》
        </Link>

        <header className="glass-panel relative mb-6 overflow-hidden rounded-3xl p-6 md:p-8">
          {(seasonData.season.coverUrl || series.cover_url) && <Image src={seasonData.season.coverUrl || series.cover_url} alt="" fill priority className="-z-10 object-cover opacity-10 blur-2xl" sizes="100vw" />}
          <div className="flex flex-col gap-6 sm:flex-row md:gap-8">
            <div className="relative aspect-2/3 w-full max-w-72 shrink-0 self-center overflow-hidden rounded-2xl border border-white/15 bg-black/30 shadow-[0_12px_35px_rgba(0,0,0,0.35)] md:w-72 md:self-start">
              {seasonData.season.coverUrl ? (
                <Image src={seasonData.season.coverUrl} alt={`${seasonData.season.title} 海报`} fill priority className="object-cover" sizes="(max-width: 768px) 100vw, 288px" />
              ) : (
                <div className="flex h-full items-center justify-center text-white/25"><ImageIcon className="size-9" aria-hidden="true" /></div>
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
              {previousSeason && <Link href={`/series/${id}/seasons/${previousSeason.id}`} className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label={`上一季：第 ${previousSeason.seasonNumber} 季`}><ChevronLeft className="size-4" /></Link>}
              <div className="flex max-w-72 gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-1">
                {seasons.map((season) => (
                  <Link key={season.id} href={`/series/${id}/seasons/${season.id}`} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition-colors ${season.id === seasonId ? "bg-red-500/20 text-red-300" : "text-white/45 hover:bg-white/10 hover:text-white"}`}>
                    第 {season.seasonNumber} 季
                  </Link>
                ))}
              </div>
              {nextSeason && <Link href={`/series/${id}/seasons/${nextSeason.id}`} className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label={`下一季：第 ${nextSeason.seasonNumber} 季`}><ChevronRight className="size-4" /></Link>}
                </div>
              </div>
              {seasonData.season.summary && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white/45">本季简介</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-white/70 md:text-base">
                    {seasonData.season.summary}
                  </p>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="本季统计">
          {[
            ["观看进度", `${seasonData.watchedCount} / ${seasonData.season.episodeCount}`],
            ["完成比例", `${watchedPercent}%`],
            ["总时长", `${Math.round(seasonData.totalRuntime / 60)} 小时`],
            ["平均评分", seasonData.averageRating === null ? "—" : seasonData.averageRating.toFixed(1)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <p className="text-xs text-white/40">{label}</p>
              <p className="mt-2 font-mono text-xl text-white">{value}</p>
            </div>
          ))}
        </section>

        <div className="glass-panel sticky top-20 z-20 mb-6 flex flex-col justify-between gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 overflow-x-auto">
            <ListFilter className="ml-1 size-4 shrink-0 text-white/60" />
            {(["all", "watched", "unwatched"] as const).map((value) => (
              <Link key={value} href={seasonHref({ page: 1, status: value })} className={`shrink-0 rounded-lg border px-4 py-1.5 text-[13px] backdrop-blur-2xl transition-all duration-300 ${status === value ? "border-red-400/40 bg-red-500/15 font-bold text-red-400 shadow-[0_4px_10px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]" : "border-white/10 bg-white/5 text-white/70 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:border-white/20 hover:bg-white/10 hover:text-white hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"}`}>
                {{ all: "全部", watched: "已看", unwatched: "未看" }[value]}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/60">集数</span>
            <Link href={seasonHref({ page: 1, order: order === "asc" ? "desc" : "asc" })} className="rounded-lg border border-red-400/40 bg-red-500/15 px-4 py-1.5 text-[13px] font-bold text-red-400 shadow-[0_4px_10px_rgba(248,113,113,0.2)] backdrop-blur-2xl drop-shadow-[0_0_3px_rgba(248,113,113,0.3)] transition-all duration-300 hover:bg-red-500/25">
              {order === "asc" ? "升序 ↑" : "降序 ↓"}
            </Link>
            <span className="ml-auto text-white/60 sm:ml-2">{seasonData.total} 集</span>
          </div>
        </div>

        {seasonData.episodes.length > 0 ? (
          <div className="space-y-3">
            {seasonData.episodes.map((episode) => <EpisodeCard key={episode.id} episode={episode} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-20 text-center text-white/40">当前筛选下暂无剧集</div>
        )}

        {totalPages > 1 && (
          <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="剧集分页">
            {page > 1 && <Link href={seasonHref({ page: page - 1 })} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="上一页"><ChevronLeft className="size-4" /></Link>}
            {pageNumbers(page, totalPages).map((pageNumber) => (
              <Link key={pageNumber} href={seasonHref({ page: pageNumber })} className={`min-w-10 rounded-xl border px-3 py-2 text-center text-sm ${pageNumber === page ? "border-red-400/30 bg-red-500/15 text-red-300" : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}>
                {pageNumber}
              </Link>
            ))}
            {page < totalPages && <Link href={seasonHref({ page: page + 1 })} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="下一页"><ChevronRight className="size-4" /></Link>}
          </nav>
        )}
      </div>
    </div>
  );
}
