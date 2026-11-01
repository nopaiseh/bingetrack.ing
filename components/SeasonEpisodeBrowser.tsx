"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatRuntime } from "@/lib/format-runtime";
import { pageNumbers } from "@/lib/pagination";
import {
  isDefaultSeasonBrowseQuery,
  readSeasonBrowseQuery,
  SEASON_EPISODE_PAGE_SIZE,
  seasonBrowseHref,
  seasonBrowseKey,
  seasonEpisodeListPath,
  type SeasonBrowseQuery,
  type SeasonEpisodeListResponse,
  type SeasonStatusFilter,
} from "@/lib/season-browse";
import type { EpisodeInfo } from "@/lib/types";

const STATUS_LABELS: Record<SeasonStatusFilter, string> = { all: "全部", watched: "已看", unwatched: "未看" };

type LoadedList = {
  key: string;
  episodes: EpisodeInfo[];
  total: number;
  error: string | null;
};

/** 渲染单集卡片，展示封面、集数、标题、观看状态、上映日期和简介。 */
function EpisodeCard({ episode }: { episode: EpisodeInfo }) {
  const watched = episode.status === "watched";
  const episodeRuntimeLabel = formatRuntime(episode.runtime);

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
            <h2 className="line-clamp-2 font-bold text-fg transition-colors group-hover:text-[var(--accent-hover)]" title={episode.title}>
              {episode.title}
            </h2>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            watched ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400" : "surface-muted border-white/10 text-fg-muted"
          }`}>
            {watched ? <span className="i-material-symbols-check-circle-rounded inline-block size-3" aria-hidden="true" /> : <span className="i-material-symbols-visibility-rounded inline-block size-3" aria-hidden="true" />}
            {watched ? "已看" : "未看"}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          {episode.releaseDate && <span className="flex items-center gap-1"><span className="i-material-symbols-calendar-today-rounded inline-block size-3" aria-hidden="true" />{episode.releaseDate}</span>}
          {episodeRuntimeLabel && <span className="flex items-center gap-1"><span className="i-material-symbols-schedule-rounded inline-block size-3" aria-hidden="true" />{episodeRuntimeLabel}</span>}
          {episode.rating !== null && <span className="flex items-center gap-1 text-amber-400"><span className="i-material-symbols-star-rounded inline-block size-3 text-amber-400" aria-hidden="true" />{episode.rating.toFixed(1)}</span>}
        </div>

        {episode.summary ? (
          <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-fg-muted sm:line-clamp-5 md:line-clamp-6" title={episode.summary}>
            {episode.summary}
          </p>
        ) : <p className="mt-3 text-sm text-fg-subtle">暂无简介。</p>}
      </div>
    </article>
  );
}

/**
 * 只读取查询串并回传给父组件。单独包在 Suspense 里，避免 useSearchParams 把整段单集列表排除出静态 HTML。
 * 父组件在水合前按空查询串渲染默认第一页，与预渲染结果一致。
 */
function SeasonQuerySync({ onChange }: { onChange: (search: string) => void }) {
  const search = useSearchParams().toString();
  useEffect(() => {
    onChange(search);
  }, [onChange, search]);
  return null;
}

/** 用可分享的查询串切换状态、排序和页码；默认第一页直接使用服务端数据，其余条件向单集接口请求。 */
export default function SeasonEpisodeBrowser({
  basePath,
  seriesId,
  seasonId,
  initialEpisodes,
  initialTotal,
}: {
  basePath: string;
  seriesId: string;
  seasonId: string;
  initialEpisodes: EpisodeInfo[];
  initialTotal: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState<LoadedList>({
    key: "",
    episodes: initialEpisodes,
    total: initialTotal,
    error: null,
  });
  const redirectedHref = useRef<string | null>(null);
  const query = readSeasonBrowseQuery(search);
  const requestKey = seasonBrowseKey(query);
  const isDefault = isDefaultSeasonBrowseQuery(query);
  const matchesRequest = isDefault || loaded.key === requestKey;
  const episodes = isDefault ? initialEpisodes : matchesRequest ? loaded.episodes : [];
  const total = isDefault ? initialTotal : matchesRequest ? loaded.total : 0;
  const error = !isDefault && matchesRequest ? loaded.error : null;
  const pending = !matchesRequest;
  const totalPages = Math.max(1, Math.ceil(total / SEASON_EPISODE_PAGE_SIZE));

  /** 在当前条件上覆盖部分字段，生成仍可分享的季页地址。 */
  const hrefFor = (overrides: Partial<SeasonBrowseQuery>) => seasonBrowseHref(basePath, { ...query, ...overrides });

  // 默认页使用服务端 HTML，不额外请求。其他分页和筛选在地址变化后读取缓存接口。
  useEffect(() => {
    const current = readSeasonBrowseQuery(search);
    if (isDefaultSeasonBrowseQuery(current)) return;
    const controller = new AbortController();
    const key = seasonBrowseKey(current);
    /** 拉取当前查询对应的单集页，失败时保留可重试的错误提示。 */
    const load = async () => {
      try {
        const response = await fetch(seasonEpisodeListPath(seriesId, seasonId, current), { signal: controller.signal });
        const body = await response.json() as Partial<SeasonEpisodeListResponse>;
        if (controller.signal.aborted) return;
        const nextTotal = Number(body.total);
        if (!response.ok || !Array.isArray(body.episodes) || !Number.isFinite(nextTotal)) {
          throw new Error(`Unable to load episodes (${response.status})`);
        }
        setLoaded({ key, episodes: body.episodes, total: nextTotal, error: null });
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") return;
        setLoaded({ key, episodes: [], total: 0, error: "单集列表暂时无法加载，请稍后重试。" });
      }
    };
    void load();
    return () => controller.abort();
  }, [search, seriesId, seasonId]);

  // 超出末页时改写到最后一页，保留原先服务端 redirect 的地址行为。
  useEffect(() => {
    const current = readSeasonBrowseQuery(search);
    const key = seasonBrowseKey(current);
    if (loaded.key !== key || loaded.error) return;
    const lastPage = Math.max(1, Math.ceil(loaded.total / SEASON_EPISODE_PAGE_SIZE));
    if (current.page <= lastPage) return;
    const href = seasonBrowseHref(basePath, { ...current, page: lastPage });
    const marker = `${search}>${href}`;
    if (redirectedHref.current === marker) return;
    redirectedHref.current = marker;
    router.replace(href);
  }, [basePath, loaded, router, search]);

  return (
    <>
      <Suspense fallback={null}>
        <SeasonQuerySync onChange={setSearch} />
      </Suspense>

      <div className="surface-overlay sticky top-20 z-20 mb-6 flex flex-col justify-between gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="i-material-symbols-filter-list-rounded ml-1 size-4 shrink-0 text-fg-muted inline-block" aria-hidden="true" />
          {(["all", "watched", "unwatched"] as const).map(/* 生成观看状态筛选链接，切换状态时回到第一页。 */ (value) => (
            <Link key={value} href={hrefFor({ page: 1, status: value })} className={`shrink-0 rounded-lg border px-4 py-1.5 text-[13px] backdrop-blur-2xl transition-all duration-300 ${query.status === value ? "surface-active border-[var(--accent-border)] font-bold text-[var(--accent-hover)] shadow-[0_4px_10px_var(--accent-glow-soft)] drop-shadow-[0_0_3px_var(--accent-glow-soft)]" : "surface-muted border-white/10 text-fg-secondary shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:border-white/20 hover:bg-white/10 hover:text-white hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"}`}>
              {STATUS_LABELS[value]}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-fg-muted">集数</span>
          <Link href={hrefFor({ page: 1, order: query.order === "asc" ? "desc" : "asc" })} className="surface-active rounded-lg border border-[var(--accent-border)] px-4 py-1.5 text-[13px] font-bold text-[var(--accent-hover)] shadow-[0_4px_10px_var(--accent-glow-soft)] backdrop-blur-2xl drop-shadow-[0_0_3px_var(--accent-glow-soft)] transition-all duration-300 hover:bg-[var(--accent-soft)]">
            {query.order === "asc" ? "升序 ↑" : "降序 ↓"}
          </Link>
          <span className="ml-auto text-fg-muted sm:ml-2">{pending ? "加载中" : `${total} 集`}</span>
        </div>
      </div>

      {pending ? (
        <p className="surface-muted rounded-2xl border border-white/10 py-20 text-center text-fg-muted" role="status">正在加载单集…</p>
      ) : error ? (
        <p className="surface-muted rounded-2xl border border-white/10 py-20 text-center text-fg-muted" role="alert">{error}</p>
      ) : episodes.length > 0 ? (
        <div className="space-y-3">
          {episodes.map(/* 将当前页的一集数据渲染为单集卡片。 */ (episode) => <EpisodeCard key={episode.id} episode={episode} />)}
        </div>
      ) : (
        <div className="surface-muted rounded-2xl border border-white/10 py-20 text-center text-fg-muted">当前筛选下暂无单集</div>
      )}

      {!pending && !error && totalPages > 1 && (
        <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="单集分页">
          {query.page > 1 && <Link href={hrefFor({ page: query.page - 1 })} className="surface-control rounded-xl p-2.5 text-fg-secondary transition-all hover:text-white" aria-label="上一页"><span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" /></Link>}
          {pageNumbers(query.page, totalPages).map(/* 生成保留当前筛选条件的页码链接，并标记当前页。 */ (pageNumber) => (
            <Link key={pageNumber} href={hrefFor({ page: pageNumber })} aria-current={pageNumber === query.page ? "page" : undefined} className={`min-w-10 rounded-xl px-3 py-2 text-center text-sm transition-all ${pageNumber === query.page ? "filter-option-active shadow-md" : "surface-muted border border-white/10 text-fg-secondary hover:bg-white/10 hover:text-white"}`}>
              {pageNumber}
            </Link>
          ))}
          {query.page < totalPages && <Link href={hrefFor({ page: query.page + 1 })} className="surface-control rounded-xl p-2.5 text-fg-secondary transition-all hover:text-white" aria-label="下一页"><span className="i-material-symbols-chevron-right-rounded inline-block size-4" aria-hidden="true" /></Link>}
        </nav>
      )}
    </>
  );
}
