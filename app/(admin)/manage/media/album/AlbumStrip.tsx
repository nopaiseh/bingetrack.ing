"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { mayLeaveEditor } from "@/lib/admin/navigation";
import type { AlbumStructure } from "@/lib/admin/album-structure";
import { centerInside } from "../series/SeriesRail";
import { TRACK_JUMP_THRESHOLD } from "./AlbumRail";
import { albumMediaHref, formatCount, trackLabel, type AlbumCurrentItem } from "./shared";

/** 手机与平板的曲目结构：曲序横向滚动，条数再多也不会撑破版面。 */
export default function AlbumStrip({
  structure,
  current,
  onAdd,
}: {
  structure: AlbumStructure;
  current: AlbumCurrentItem;
  onAdd: () => void;
}) {
  const router = useRouter();
  const strip = useRef<HTMLDivElement>(null);
  const { tracks, nextTrackNumber } = structure;

  useEffect(() => {
    const row = strip.current;
    centerInside(row, row?.querySelector<HTMLElement>('[aria-current="page"]') ?? null, "x");
  }, [current.id]);

  function go(href: string) {
    if (mayLeaveEditor()) router.push(href);
  }

  function jumpToTrack(value: string) {
    const target = tracks.find((track) => track.number === Number(value));
    if (target) go(albumMediaHref("music", target.id));
  }

  return (
    <section aria-label="曲目结构" className="surface-panel space-y-2.5 rounded-2xl p-3 lg:hidden">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <Link
            href={albumMediaHref("album", structure.album.id)}
            aria-current={current.type === "album" ? "page" : undefined}
            className={`block truncate text-sm font-medium ${current.type === "album" ? "text-[var(--accent-light)]" : "text-white"}`}
          >
            {structure.album.title}
          </Link>
          <p className="font-mono text-xs text-neutral-400">{formatCount(tracks.length)} 首</p>
        </div>
        <button type="button" onClick={onAdd} className="admin-add shrink-0">
          <span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />第{" "}
          {formatCount(nextTrackNumber)} 首
        </button>
      </div>

      {tracks.length > 0 && (
        <div ref={strip} className="relative -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" aria-label="曲目">
          {tracks.map((track) => {
            const selected = current.type === "music" && current.id === track.id;
            return (
              <Link
                key={track.id}
                href={albumMediaHref("music", track.id)}
                aria-current={selected ? "page" : undefined}
                aria-label={`第 ${track.number} 首：${track.title}${track.listened ? "（听过）" : ""}`}
                className={`relative inline-flex h-11 min-w-12 shrink-0 items-center justify-center rounded-[10px] border px-2.5 font-mono text-[13px] ${selected ? "border-[var(--accent-border)] bg-[var(--accent-soft)] font-semibold text-[var(--accent-light)]" : "border-white/12 bg-white/5 text-neutral-300"}`}
              >
                {trackLabel(track.number)}
                {track.listened && (
                  <span
                    className="absolute bottom-1.5 size-1 rounded-full bg-[var(--accent-light)]"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}

      {tracks.length > TRACK_JUMP_THRESHOLD && (
        <label>
          <span className="sr-only">跳到曲序，按回车打开</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="跳到曲序"
            enterKeyHint="go"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jumpToTrack(event.currentTarget.value);
              }
            }}
            className="font-mono !text-[13px]"
          />
        </label>
      )}
    </section>
  );
}
