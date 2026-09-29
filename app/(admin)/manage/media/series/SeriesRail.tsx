"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { mayLeaveEditor } from "@/lib/admin/navigation";
import type { SeriesStructure, WatchStatus } from "@/lib/admin/series-structure";
import { episodeLabel, formatCount, mediaHref, statusLabels, type CurrentItem, type QuickAddKind } from "./shared";

/** 季数不多时以树形展开，超过后改用下拉选择，避免季列表把单集挤出视野。 */
export const TREE_LIMIT = 8;
/** 单集较多时提供跳到集号。 */
export const JUMP_THRESHOLD = 20;

/** 观看状态圆点：看过实心、在看半满、没看过空心，形状不同，不只靠颜色区分。 */
export function StatusDot({ status }: { status: WatchStatus }) {
  return <span className={`status-dot status-dot-${status}`} role="img" aria-label={statusLabels[status]} />;
}

/** 把列表内的元素滚到容器中部，不牵动整页滚动。 */
export function centerInside(container: HTMLElement | null, element: HTMLElement | null, axis: "x" | "y") {
  if (!container || !element) return;
  if (axis === "y") container.scrollTop = element.offsetTop - container.clientHeight / 2 + element.offsetHeight / 2;
  else container.scrollLeft = element.offsetLeft - container.clientWidth / 2 + element.offsetWidth / 2;
}

/** 桌面编辑页右侧的剧集结构栏：与左侧导航同高并跟随滚动，是新增季与单集的唯一入口。 */
export default function SeriesRail({ structure, current, onAdd }: { structure: SeriesStructure; current: CurrentItem; onAdd: (kind: QuickAddKind) => void }) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const { show, seasons, episodes, expandedSeasonId, nextEpisode } = structure;
  const expanded = seasons.find(season => season.id === expandedSeasonId);
  const tree = seasons.length <= TREE_LIMIT;

  useEffect(() => {
    const box = scroller.current;
    centerInside(box, box?.querySelector<HTMLElement>('[aria-current="page"]') ?? null, "y");
  }, [current.id]);

  /** 下拉与跳转不是原生链接，离开前复用未保存检查。 */
  function go(href: string) { if (mayLeaveEditor()) router.push(href); }
  /** 输入时滚到对应集，按回车打开。 */
  function jump(value: string, open: boolean) {
    const target = episodes.find(episode => episode.number === Number(value));
    if (!target) return;
    centerInside(scroller.current, scroller.current?.querySelector<HTMLElement>(`[data-episode="${target.id}"]`) ?? null, "y");
    if (open) go(mediaHref("tv_episode", target.id));
  }

  const episodeList = episodes.length ? <ul className="space-y-0.5">{episodes.map(episode => {
    const selected = current.type === "tv_episode" && current.id === episode.id;
    return <li key={episode.id}>
      <Link href={mediaHref("tv_episode", episode.id)} data-episode={episode.id} aria-current={selected ? "page" : undefined} className={`flex min-h-9 items-center gap-2.5 rounded-lg border px-2.5 text-[13px] transition-colors ${selected ? "border-[var(--accent-border)] bg-[var(--accent-soft)] font-medium text-[var(--accent-light)]" : "border-transparent text-neutral-300 hover:bg-white/5 hover:text-white"}`}>
        <span className={`min-w-6 font-mono text-xs ${selected ? "text-[var(--accent-light)]" : "text-neutral-400"}`}>{episodeLabel(episode.number)}</span>
        <span className="min-w-0 flex-1 truncate">{episode.title}</span>
        <StatusDot status={episode.watched ? "watched" : "want_to_watch"} />
      </Link>
    </li>;
  })}</ul> : <p className="px-2.5 py-2 text-xs text-neutral-400">这一季还没有单集。</p>;

  return <aside aria-label="剧集结构" className="admin-side-panel admin-rail-panel surface-panel hidden min-w-0 flex-col gap-3 rounded-2xl p-4 lg:sticky lg:top-24 lg:flex">
    <div className="flex items-center justify-between px-1">
      <p className="text-xs tracking-wider text-fg-subtle">剧集结构</p>
      <p className="font-mono text-[11px] text-fg-subtle">{formatCount(seasons.length)} 季 · {formatCount(structure.totalEpisodes)} 集</p>
    </div>
    <Link href={mediaHref("tv_show", show.id)} aria-current={current.type === "tv_show" ? "page" : undefined} className={`flex items-center gap-3 rounded-xl border p-2 transition-colors ${current.type === "tv_show" ? "border-[var(--accent-border)] bg-[var(--accent-soft)]" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"}`}>
      {show.coverUrl ? <Image src={show.coverUrl} alt="" width={36} height={54} className="h-[54px] w-9 shrink-0 rounded-md object-cover" /> : <span className="surface-muted h-[54px] w-9 shrink-0 rounded-md" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-white">{show.title}</span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-px text-[11px] font-semibold text-sky-300">电视节目</span>
          <span className="font-mono text-xs text-neutral-400">{statusLabels[show.status]}{show.rating != null ? ` · ${show.rating.toFixed(1)}` : ""}</span>
        </span>
      </span>
    </Link>

    {!tree && expanded && <div className="flex gap-2">
      <label className="min-w-0 flex-1"><span className="sr-only">选择季</span>
        <select value={expanded.id} onChange={event => go(mediaHref("tv_season", event.target.value))} className="font-mono !text-[13px]">
          {seasons.map(season => <option key={season.id} value={season.id}>S{season.number} · 第 {season.number} 季 · {formatCount(season.episodeCount)} 集</option>)}
        </select>
      </label>
      <Link href={mediaHref("tv_season", expanded.id)} aria-label={`编辑第 ${expanded.number} 季`} aria-current={current.type === "tv_season" ? "page" : undefined} className={`admin-button !w-11 !px-0 ${current.type === "tv_season" ? "!border-[var(--accent-border)] !bg-[var(--accent-soft)] text-[var(--accent-light)]" : ""}`}><span className="i-material-symbols-edit-rounded size-4.5" aria-hidden="true" /></Link>
    </div>}
    {episodes.length > JUMP_THRESHOLD && <label className="relative"><span className="sr-only">跳到集号，按回车打开</span>
      <span className="i-material-symbols-search-rounded pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
      <input type="number" inputMode="numeric" min="0" placeholder="跳到集号" onChange={event => jump(event.target.value, false)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); jump(event.currentTarget.value, true); } }} className="!min-h-10 !py-2 !pl-9 font-mono !text-[13px]" />
    </label>}

    <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
      {!seasons.length && <p className="px-2.5 py-2 text-sm text-neutral-400">还没有季，先新增第 1 季。</p>}
      {tree ? <ul className="space-y-0.5">{seasons.map(season => {
        const open = season.id === expandedSeasonId;
        const selected = current.type === "tv_season" && current.id === season.id;
        return <li key={season.id}>
          <Link href={mediaHref("tv_season", season.id)} aria-current={selected ? "page" : undefined} aria-expanded={open} className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-2.5 text-sm font-medium transition-colors ${selected ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-light)]" : "border-transparent text-white hover:bg-white/5"}`}>
            <span className={`${open ? "i-material-symbols-expand-more-rounded text-amber-300" : "i-material-symbols-chevron-right-rounded text-neutral-400"} size-4 shrink-0`} aria-hidden="true" />
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-px font-mono text-[11px] font-semibold text-amber-300">S{season.number}</span>
            <span className="truncate">{season.title}</span>
            <span className="ml-auto whitespace-nowrap font-mono text-xs font-normal text-neutral-400">{formatCount(season.episodeCount)} 集 · {statusLabels[season.status]}</span>
          </Link>
          {open && <div className="my-1 ml-[1.125rem] border-l border-amber-500/25 pl-3">{episodeList}</div>}
        </li>;
      })}</ul> : episodeList}
    </div>

    {expanded && nextEpisode && <button type="button" onClick={() => onAdd("episode")} className="admin-add !justify-start"><span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />新增第 {formatCount(nextEpisode.number)} 集<span className="ml-auto text-xs font-normal text-[var(--accent-light)]/80">第 {expanded.number} 季</span></button>}
    <div className="border-t border-white/10 pt-3">
      <button type="button" onClick={() => onAdd("season")} className="admin-add w-full !justify-start"><span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />新增第 {formatCount(structure.nextSeasonNumber)} 季</button>
    </div>
    <p className="flex gap-3.5 px-1 text-[11px] text-neutral-400" aria-hidden="true">
      <span className="inline-flex items-center gap-1.5"><StatusDot status="watched" />看过</span>
      <span className="inline-flex items-center gap-1.5"><StatusDot status="watching" />在看</span>
      <span className="inline-flex items-center gap-1.5"><StatusDot status="want_to_watch" />没看过</span>
    </p>
  </aside>;
}
