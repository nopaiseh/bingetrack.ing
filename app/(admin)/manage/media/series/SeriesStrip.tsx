"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import { mayLeaveEditor } from "@/lib/admin/navigation";
import type { SeriesStructure } from "@/lib/admin/series-structure";
import { centerInside, JUMP_THRESHOLD, StatusDot } from "./SeriesRail";
import { formatCount, mediaHref, statusLabels, type CurrentItem, type QuickAddKind } from "./shared";

/** 手机与平板的剧集结构：季从底部面板选择，单集横向滚动，季数与集数多少都不会撑破版面。 */
export default function SeriesStrip({ structure, current, onAdd }: { structure: SeriesStructure; current: CurrentItem; onAdd: (kind: QuickAddKind) => void }) {
  const router = useRouter();
  const strip = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const sheetHeading = useId();
  const { show, seasons, episodes, expandedSeasonId, nextEpisode } = structure;
  const expanded = seasons.find(season => season.id === expandedSeasonId);

  useEffect(() => {
    const row = strip.current;
    centerInside(row, row?.querySelector<HTMLElement>('[aria-current="page"]') ?? null, "x");
  }, [current.id]);

  /** 跳转不是原生链接，离开前复用未保存检查。 */
  function go(href: string) { if (mayLeaveEditor()) router.push(href); }
  function jumpToEpisode(value: string) {
    const target = episodes.find(episode => episode.number === Number(value));
    if (target) go(mediaHref("tv_episode", target.id));
  }
  function jumpToSeason(value: string) {
    const target = seasons.find(season => season.number === Number(value));
    if (target) { sheet.current?.close(); go(mediaHref("tv_season", target.id)); }
  }

  return <section aria-label="剧集结构" className="surface-panel space-y-2.5 rounded-2xl p-3 lg:hidden">
    {expanded ? <button type="button" onClick={() => sheet.current?.showModal()} className="w-full !justify-start !gap-2.5 !px-3">
      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-px font-mono text-[11px] font-semibold text-amber-300">S{expanded.number}</span>
      <span className="truncate">{expanded.title}</span>
      <span className="truncate font-mono text-xs font-normal text-neutral-400">{formatCount(expanded.episodeCount)} 集 · 共 {formatCount(seasons.length)} 季</span>
      <span className="i-material-symbols-expand-more-rounded ml-auto size-4.5 shrink-0 text-neutral-400" aria-hidden="true" />
    </button> : <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-neutral-400">还没有季。</p>
      <button type="button" onClick={() => onAdd("season")} className="admin-add"><span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />新增第 {formatCount(structure.nextSeasonNumber)} 季</button>
    </div>}

    {episodes.length > 0 && <div ref={strip} className="relative -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" aria-label={`第 ${expanded?.number ?? ""} 季单集`}>
      {episodes.map(episode => {
        const selected = current.type === "tv_episode" && current.id === episode.id;
        return <Link key={episode.id} href={mediaHref("tv_episode", episode.id)} aria-current={selected ? "page" : undefined} aria-label={`第 ${episode.number} 集：${episode.title}（${episode.watched ? "看过" : "没看过"}）`}
          className={`relative inline-flex h-11 min-w-12 shrink-0 items-center justify-center rounded-[10px] border px-2.5 font-mono text-[13px] ${selected ? "border-[var(--accent-border)] bg-[var(--accent-soft)] font-semibold text-[var(--accent-light)]" : "border-white/12 bg-white/5 text-neutral-300"}`}>
          {episode.number}
          {episode.watched && <span className="absolute bottom-1.5 size-1 rounded-full bg-[var(--accent-light)]" aria-hidden="true" />}
        </Link>;
      })}
    </div>}

    {expanded && nextEpisode && <div className="flex gap-2">
      {episodes.length > JUMP_THRESHOLD && <label className="min-w-0 flex-1"><span className="sr-only">跳到集号，按回车打开</span>
        <input type="number" inputMode="numeric" min="0" placeholder="跳到集号" enterKeyHint="go" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); jumpToEpisode(event.currentTarget.value); } }} className="font-mono !text-[13px]" />
      </label>}
      <button type="button" onClick={() => onAdd("episode")} className={`admin-add !min-h-11 ${episodes.length > JUMP_THRESHOLD ? "" : "w-full"}`}><span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />第 {formatCount(nextEpisode.number)} 集</button>
    </div>}

    <dialog ref={sheet} aria-labelledby={sheetHeading} className="admin-sheet">
      <span className="h-1 w-10 shrink-0 self-center rounded-full bg-white/25" aria-hidden="true" />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><h2 id={sheetHeading} className="text-lg font-semibold text-white">选择季</h2><p className="truncate font-mono text-xs text-neutral-400">{show.title} · {formatCount(seasons.length)} 季 · {formatCount(structure.totalEpisodes)} 集</p></div>
        <button type="button" aria-label="关闭" onClick={() => sheet.current?.close()} className="!w-11 !px-0"><span className="i-material-symbols-close-rounded size-5" aria-hidden="true" /></button>
      </div>
      {seasons.length > 8 && <label><span className="sr-only">输入季号，按回车打开</span>
        <input type="number" inputMode="numeric" min="0" placeholder="输入季号" enterKeyHint="go" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); jumpToSeason(event.currentTarget.value); } }} className="font-mono" />
      </label>}
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">{[...seasons].reverse().map(season => {
        const selected = season.id === expandedSeasonId;
        return <li key={season.id}>
          <Link href={mediaHref("tv_season", season.id)} onClick={() => sheet.current?.close()} aria-current={selected ? "true" : undefined} className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-sm ${selected ? "border-[var(--accent-border)] bg-[var(--accent-soft)] font-medium text-[var(--accent-light)]" : "border-transparent text-white"}`}>
            <span className="min-w-9 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-px text-center font-mono text-[11px] font-semibold text-amber-300">S{season.number}</span>
            <span className="truncate">{season.title}</span>
            <span className="ml-auto whitespace-nowrap font-mono text-xs text-neutral-400">{formatCount(season.episodeCount)} 集 · {statusLabels[season.status]}</span>
            <StatusDot status={season.status} />
          </Link>
        </li>;
      })}</ul>
      <button type="button" onClick={() => { sheet.current?.close(); onAdd("season"); }} className="admin-add w-full !min-h-11"><span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />新增第 {formatCount(structure.nextSeasonNumber)} 季</button>
    </dialog>
  </section>;
}
