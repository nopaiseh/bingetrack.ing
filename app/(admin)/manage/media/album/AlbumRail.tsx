"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { mayLeaveEditor } from "@/lib/admin/navigation";
import type { AlbumStructure } from "@/lib/admin/album-structure";
import { listInitial, listTint } from "../../list/model";
import { centerInside, StatusDot } from "../series/SeriesRail";
import {
  albumMediaHref,
  formatCount,
  formatSeconds,
  listenStatusLabels,
  trackLabel,
  type AlbumCurrentItem,
} from "./shared";

export const TRACK_JUMP_THRESHOLD = 20;

/** 桌面编辑页右侧曲目结构栏：贴在页头下跟随滚动，是新增曲目的入口。 */
export default function AlbumRail({
  structure,
  current,
  onAdd,
}: {
  structure: AlbumStructure;
  current: AlbumCurrentItem;
  onAdd: () => void;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const { album, tracks, trackCount, nextTrackNumber } = structure;

  useEffect(() => {
    const box = scroller.current;
    centerInside(box, box?.querySelector<HTMLElement>('[aria-current="page"]') ?? null, "y");
  }, [current.id]);

  function go(href: string) {
    if (mayLeaveEditor()) router.push(href);
  }

  function jump(value: string, open: boolean) {
    const target = tracks.find((track) => track.number === Number(value));
    if (!target) return;
    centerInside(
      scroller.current,
      scroller.current?.querySelector<HTMLElement>(`[data-track="${target.id}"]`) ?? null,
      "y",
    );
    if (open) go(albumMediaHref("music", target.id));
  }

  return (
    <aside
      aria-label="曲目结构"
      className="admin-rail-panel surface-panel hidden min-w-0 flex-col gap-3 rounded-2xl p-4 lg:sticky lg:top-4 lg:flex"
    >
      <div className="flex items-center justify-between px-1">
        <p className="text-xs tracking-wider text-fg-subtle">曲目结构</p>
        <p className="font-mono text-[11px] text-fg-subtle">{formatCount(trackCount ?? 0)} 首</p>
      </div>
      <Link
        href={albumMediaHref("album", album.id)}
        aria-current={current.type === "album" ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl border p-2 transition-colors ${current.type === "album" ? "border-[var(--accent-border)] bg-[var(--accent-soft)]" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"}`}
      >
        {album.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={album.coverUrl} alt="" width={36} height={36} className="size-9 shrink-0 rounded-md object-cover" />
        ) : (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white"
            style={{ backgroundColor: listTint(album.title) }}
            aria-hidden="true"
          >
            {listInitial(album.title)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-white">{album.title}</span>
          <span className="mt-1 flex items-center gap-1.5">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-px text-[11px] font-semibold text-emerald-300">
              专辑
            </span>
            <span className="font-mono text-xs text-neutral-400">
              {listenStatusLabels[album.status]}
              {album.rating != null ? ` · ${album.rating.toFixed(1)}` : ""}
            </span>
          </span>
        </span>
      </Link>

      {tracks.length > TRACK_JUMP_THRESHOLD && (
        <label className="relative">
          <span className="sr-only">跳到曲序，按回车打开</span>
          <span
            className="i-material-symbols-search-rounded pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden="true"
          />
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="跳到曲序"
            onChange={(event) => jump(event.target.value, false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jump(event.currentTarget.value, true);
              }
            }}
            className="!min-h-10 !py-2 !pl-9 font-mono !text-[13px]"
          />
        </label>
      )}

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {!tracks.length && <p className="px-2.5 py-2 text-sm text-neutral-400">还没有曲目，先新增第 1 首。</p>}
        <ul className="space-y-0.5">
          {tracks.map((track) => {
            const selected = current.type === "music" && current.id === track.id;
            return (
              <li key={track.id}>
                <Link
                  href={albumMediaHref("music", track.id)}
                  data-track={track.id}
                  aria-current={selected ? "page" : undefined}
                  className={`flex min-h-9 items-center gap-2.5 rounded-lg border px-2.5 text-[13px] transition-colors ${selected ? "border-[var(--accent-border)] bg-[var(--accent-soft)] font-medium text-[var(--accent-light)]" : "border-transparent text-neutral-300 hover:bg-white/5 hover:text-white"}`}
                >
                  <span
                    className={`min-w-6 font-mono text-xs ${selected ? "text-[var(--accent-light)]" : "text-neutral-400"}`}
                  >
                    {trackLabel(track.number)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{track.title}</span>
                  <span className="font-mono text-[11px] text-neutral-400">{formatSeconds(track.durationSeconds)}</span>
                  <StatusDot status={track.listened ? "watched" : "want_to_watch"} />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <button type="button" onClick={onAdd} className="admin-add !justify-start">
        <span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />
        新增第 {formatCount(nextTrackNumber)} 首
      </button>
      <p className="flex gap-3.5 px-1 text-[11px] text-neutral-400" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status="watched" />
          听过
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status="want_to_watch" />
          没听过
        </span>
      </p>
    </aside>
  );
}
