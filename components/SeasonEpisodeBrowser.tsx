"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SkeletonBlock } from "@/components/LoadingSkeletons";
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
  nextEpisodeNumber: number | null;
  error: string | null;
};

const ROW_GRID = "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 px-3.5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-6 sm:py-5";
/** 与工具条 sticky top-20 对齐，筛选后停在列表而不是整页顶部。 */
const LIST_ANCHOR_OFFSET = 80;

/** 占住原先单集行的位置。行数与上一页相同，外层再用原高度托住页面。 */
function EpisodeSkeletonList({ count }: { count: number }) {
  return (
    <div className="surface-card divide-y divide-white/[0.07] overflow-hidden rounded-[20px]" role="status" aria-busy="true" aria-label="正在加载单集">
      <span className="sr-only">正在加载单集…</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`${ROW_GRID} min-h-28`} data-testid="episode-skeleton" aria-hidden="true">
          <SkeletonBlock className="h-9 w-10 sm:h-11 sm:w-16" />
          <div className="min-w-0 space-y-2.5 pt-1">
            <SkeletonBlock className="h-4 w-2/5 max-w-48" />
            <SkeletonBlock className="h-3 w-1/3 max-w-36" />
            <SkeletonBlock className="h-3 w-4/5 max-w-xl" />
          </div>
          <SkeletonBlock className="col-start-2 h-6 w-14 rounded-full sm:col-start-3" />
        </div>
      ))}
    </div>
  );
}

/**
 * 季内筛选和翻页仍留在当前页。Next 在页顶离开视口时会把滚动拉回页面顶部，这里关掉该行为。
 * 点击时记住列表高度和滚动位置，加载中用骨架把高度垫住。
 */
function BrowseLink({
  href,
  className,
  children,
  onBrowse,
  ...rest
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onBrowse: (event: MouseEvent<HTMLAnchorElement>) => void;
} & Omit<ComponentProps<typeof Link>, "href" | "onClick" | "scroll" | "className" | "children">) {
  return (
    <Link href={href} scroll={false} onClick={onBrowse} className={className} {...rest}>
      {children}
    </Link>
  );
}

/** 已看为绿色胶囊；未记录和想看都归入未看，与筛选口径一致。 */
function StatusPill({ status }: { status: string | null }) {
  const watched = status === "watched";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
      watched ? "border-[color-mix(in_srgb,var(--ok)_45%,var(--border))] bg-[var(--ok-soft)] text-[var(--ok)]" : "border-[var(--border)] bg-[var(--surface-2)] text-fg-muted"
    }`}>
      {watched && <span className="i-material-symbols-check-circle-rounded inline-block size-3.5" aria-hidden="true" />}
      {watched ? "已看" : "未看"}
    </span>
  );
}

/** 纯文字单集行：大号集数、别名、播出信息。有简介时用 details 展开，不依赖脚本。 */
function EpisodeRow({ episode, isNext }: { episode: EpisodeInfo; isNext: boolean }) {
  const watched = episode.status === "watched";
  const runtimeLabel = formatRuntime(episode.runtime);
  const alternateTitle = episode.alternateTitle?.trim() ?? "";
  const summary = episode.summary.trim();
  const showAlternate = alternateTitle.length > 0 && alternateTitle !== episode.title.trim();
  const meta: { key: string; value: ReactNode }[] = [];
  if (episode.releaseDate) meta.push({ key: "date", value: episode.releaseDate });
  if (runtimeLabel) meta.push({ key: "runtime", value: runtimeLabel });
  if (episode.rating !== null) {
    meta.push({
      key: "rating",
      value: (
        <span className="text-amber-400">
          <span aria-hidden="true">★ </span>
          {episode.rating.toFixed(1)}
        </span>
      ),
    });
  }

  const body = (
    <>
      <div className={`font-mono text-[30px] font-light leading-none tracking-[-0.04em] sm:min-w-[76px] sm:pt-0.5 sm:text-right sm:text-[44px] ${watched ? "text-[var(--accent-hover)]" : "text-fg-subtle"}`}>
        {episode.episodeNumber}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className={`break-words text-base font-bold leading-snug sm:text-[17px] ${watched ? "text-fg" : "text-fg-secondary"}`}>
            {episode.title}
          </h2>
          {isNext && (
            <span className="inline-flex items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium leading-none text-[var(--accent-hover)]">
              下一集
            </span>
          )}
        </div>
        {showAlternate && <p className="mt-0.5 break-words text-[12.5px] leading-snug text-fg-subtle">{alternateTitle}</p>}
        {meta.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-fg-muted">
            {meta.map((item, index) => (
              <span key={item.key} className="inline-flex items-center gap-3.5">
                {index > 0 && <span aria-hidden="true" className="text-white/25">·</span>}
                {item.value}
              </span>
            ))}
          </div>
        )}
        {summary && (
          <>
            <p className="episode-blurb mt-2.5 text-sm leading-[1.7]">{summary}</p>
            <span className="mt-1.5 inline-block text-[12.5px] text-[var(--accent-hover)]">
              <span className="episode-expand-closed">展开简介 ▾</span>
              <span className="episode-expand-open">收起 ▴</span>
            </span>
          </>
        )}
      </div>
      <div className="col-start-2 justify-self-start sm:col-start-3 sm:row-start-1 sm:self-start">
        <StatusPill status={episode.status} />
      </div>
    </>
  );

  if (!summary) {
    return <article className={`episode-row ${ROW_GRID}${isNext ? " episode-next" : ""}`}>{body}</article>;
  }

  return (
    <details className={isNext ? "episode-row episode-next" : "episode-row"}>
      <summary className={ROW_GRID}>{body}</summary>
    </details>
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
  initialNextEpisodeNumber = null,
}: {
  basePath: string;
  seriesId: string;
  seasonId: string;
  initialEpisodes: EpisodeInfo[];
  initialTotal: number;
  initialNextEpisodeNumber?: number | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const scrollLock = useRef<number | null>(null);
  const [listSnapshot, setListSnapshot] = useState({
    height: 0,
    rows: Math.max(initialEpisodes.length, 1),
    total: initialTotal,
  });
  const [loaded, setLoaded] = useState<LoadedList>({
    key: "",
    episodes: initialEpisodes,
    total: initialTotal,
    nextEpisodeNumber: initialNextEpisodeNumber,
    error: null,
  });
  const redirectedHref = useRef<string | null>(null);
  const query = readSeasonBrowseQuery(search);
  const requestKey = seasonBrowseKey(query);
  const isDefault = isDefaultSeasonBrowseQuery(query);
  const matchesRequest = isDefault || loaded.key === requestKey;
  const episodes = isDefault ? initialEpisodes : matchesRequest ? loaded.episodes : [];
  const total = isDefault ? initialTotal : matchesRequest ? loaded.total : 0;
  const nextEpisodeNumber = isDefault ? initialNextEpisodeNumber : matchesRequest ? loaded.nextEpisodeNumber : null;
  const error = !isDefault && matchesRequest ? loaded.error : null;
  const pending = !matchesRequest;
  const episodeCount = episodes.length;
  const pagerTotal = pending ? listSnapshot.total : total;
  const totalPages = Math.max(1, Math.ceil(pagerTotal / SEASON_EPISODE_PAGE_SIZE));

  /** 在当前条件上覆盖部分字段，生成仍可分享的季页地址。 */
  const hrefFor = (overrides: Partial<SeasonBrowseQuery>) => seasonBrowseHref(basePath, { ...query, ...overrides });

  /**
   * 记住列表高度，并把视口停在列表工具条。
   * 页顶离开视口时 Next 会滚回页面顶部；这里改停在工具条，加载中的骨架也从列表开头排起。
   */
  const onBrowseClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const height = listRef.current?.getBoundingClientRect().height ?? 0;
    setListSnapshot((current) => ({
      height: height > 0 ? height : current.height,
      rows: episodeCount > 0 ? episodeCount : current.rows,
      total,
    }));
    const anchorTop = anchorRef.current?.getBoundingClientRect().top;
    const top = anchorTop === undefined ? window.scrollY : Math.max(0, Math.round(anchorTop + window.scrollY - LIST_ANCHOR_OFFSET));
    scrollLock.current = top;
    if (Math.abs(window.scrollY - top) > 1) window.scrollTo({ top, behavior: "auto" });
  };

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
        const nextEpisode = body.nextEpisodeNumber;
        if (!response.ok || !Array.isArray(body.episodes) || !Number.isFinite(nextTotal)) {
          throw new Error(`Unable to load episodes (${response.status})`);
        }
        setLoaded({
          key,
          episodes: body.episodes,
          total: nextTotal,
          nextEpisodeNumber: typeof nextEpisode === "number" && Number.isInteger(nextEpisode) && nextEpisode >= 0 ? nextEpisode : null,
          error: null,
        });
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") return;
        setLoaded({ key, episodes: [], total: 0, nextEpisodeNumber: null, error: "单集列表暂时无法加载，请稍后重试。" });
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
    router.replace(href, { scroll: false });
  }, [basePath, loaded, router, search]);

  // 列表还在时记下高度；若这次浏览把滚动带回页顶，在绘制前拉回点击时的位置，工具条因此仍停在视口里。
  useLayoutEffect(() => {
    if (pending) {
      const locked = scrollLock.current;
      if (locked === null) return;
      scrollLock.current = null;
      if (Math.abs(window.scrollY - locked) > 1) window.scrollTo({ top: locked, behavior: "auto" });
      return;
    }
    const height = listRef.current?.getBoundingClientRect().height ?? 0;
    setListSnapshot((current) => {
      const next = {
        height: height > 0 ? height : current.height,
        rows: episodeCount > 0 ? episodeCount : current.rows,
        total,
      };
      if (next.height === current.height && next.rows === current.rows && next.total === current.total) return current;
      return next;
    });
  }, [episodeCount, pending, search, total]);

  return (
    <>
      <Suspense fallback={null}>
        <SeasonQuerySync onChange={setSearch} />
      </Suspense>

      <div ref={anchorRef} data-testid="episode-list-anchor" />
      <div className="surface-overlay sticky top-20 z-20 mb-6 flex flex-col justify-between gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="i-material-symbols-filter-list-rounded ml-1 size-4 shrink-0 text-fg-muted inline-block" aria-hidden="true" />
          {(["all", "watched", "unwatched"] as const).map(/* 生成观看状态筛选链接，切换状态时回到第一页。 */ (value) => (
            <BrowseLink key={value} href={hrefFor({ page: 1, status: value })} onBrowse={onBrowseClick} className={`shrink-0 rounded-lg border px-4 py-1.5 text-[13px] backdrop-blur-2xl transition-all duration-300 ${query.status === value ? "surface-active border-[var(--accent-border)] font-bold text-[var(--accent-hover)] shadow-[0_4px_10px_var(--accent-glow-soft)] drop-shadow-[0_0_3px_var(--accent-glow-soft)]" : "surface-muted border-white/10 text-fg-secondary shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:border-white/20 hover:bg-white/10 hover:text-white hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"}`}>
              {STATUS_LABELS[value]}
            </BrowseLink>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-fg-muted">集数</span>
          <BrowseLink href={hrefFor({ page: 1, order: query.order === "asc" ? "desc" : "asc" })} onBrowse={onBrowseClick} className="surface-active rounded-lg border border-[var(--accent-border)] px-4 py-1.5 text-[13px] font-bold text-[var(--accent-hover)] shadow-[0_4px_10px_var(--accent-glow-soft)] backdrop-blur-2xl drop-shadow-[0_0_3px_var(--accent-glow-soft)] transition-all duration-300 hover:bg-[var(--accent-soft)]">
            {query.order === "asc" ? "升序 ↑" : "降序 ↓"}
          </BrowseLink>
          <span className="ml-auto text-fg-muted sm:ml-2">{pending ? "加载中" : `${total} 集`}</span>
        </div>
      </div>

      <div
        ref={listRef}
        data-testid="episode-list"
        style={{
          overflowAnchor: "none",
          minHeight: pending && listSnapshot.height > 0 ? listSnapshot.height : undefined,
        }}
      >
        {pending ? (
          <EpisodeSkeletonList count={listSnapshot.rows} />
        ) : error ? (
          <p className="surface-muted rounded-2xl border border-white/10 py-20 text-center text-fg-muted" role="alert">{error}</p>
        ) : episodes.length > 0 ? (
          <section className="surface-card divide-y divide-white/[0.07] overflow-hidden rounded-[20px]" aria-label="单集列表">
            {episodes.map(/* 将当前页的一集渲染为文字行，并标出整季的下一集。 */ (episode) => (
              <EpisodeRow
                key={episode.id}
                episode={episode}
                isNext={episode.status !== "watched" && episode.episodeNumber === nextEpisodeNumber}
              />
            ))}
          </section>
        ) : (
          <div className="surface-muted rounded-2xl border border-white/10 py-20 text-center text-fg-muted">当前筛选下暂无单集</div>
        )}
      </div>

      {!error && totalPages > 1 ? (
        <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="单集分页">
          {query.page > 1 ? <BrowseLink href={hrefFor({ page: query.page - 1 })} onBrowse={onBrowseClick} className="surface-control rounded-xl p-2.5 text-fg-secondary transition-all hover:text-white" aria-label="上一页"><span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" /></BrowseLink> : null}
          {pageNumbers(query.page, totalPages).map(/* 生成保留当前筛选条件的页码链接，并标记当前页。 */ (pageNumber) => (
            <BrowseLink key={pageNumber} href={hrefFor({ page: pageNumber })} onBrowse={onBrowseClick} aria-current={pageNumber === query.page ? "page" : undefined} className={`min-w-10 rounded-xl px-3 py-2 text-center text-sm transition-all ${pageNumber === query.page ? "filter-option-active shadow-md" : "surface-muted border border-white/10 text-fg-secondary hover:bg-white/10 hover:text-white"}`}>
              {pageNumber}
            </BrowseLink>
          ))}
          {query.page < totalPages ? <BrowseLink href={hrefFor({ page: query.page + 1 })} onBrowse={onBrowseClick} className="surface-control rounded-xl p-2.5 text-fg-secondary transition-all hover:text-white" aria-label="下一页"><span className="i-material-symbols-chevron-right-rounded inline-block size-4" aria-hidden="true" /></BrowseLink> : null}
        </nav>
      ) : null}
    </>
  );
}
