"use client";
import Link from "next/link";
import LetterTile from "@/components/LetterTile";
import type { AlbumStructure } from "@/lib/admin/album-structure";
import {
  JUMP_THRESHOLD,
  StatusDot,
  centerInside,
  JumpNumberField,
  useCenterCurrent,
  useSafeNavigate,
} from "../structure-shared";
import {
  albumMediaHref,
  formatCount,
  formatSeconds,
  listenStatusLabels,
  trackLabel,
  type AlbumCurrentItem,
} from "./shared";

/** 与剧集轨共用跳转阈值；保留别名避免专辑侧引用断裂。 */
export const TRACK_JUMP_THRESHOLD = JUMP_THRESHOLD;

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
  const go = useSafeNavigate();
  const scroller = useCenterCurrent("y", current.id);
  const { album, tracks, trackCount, nextTrackNumber } = structure;

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
          <span className="relative size-9 shrink-0 overflow-hidden rounded-md">
            <LetterTile title={album.title} decorative />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-white">{album.title}</span>
          <span className="mt-1 flex items-center gap-1.5">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-px text-[11px] font-semibold text-emerald-300">
              专辑
            </span>
            <span className="font-mono text-xs text-fg-muted">
              {listenStatusLabels[album.status]}
              {album.rating != null ? ` · ${album.rating.toFixed(1)}` : ""}
            </span>
          </span>
        </span>
      </Link>

      {tracks.length > TRACK_JUMP_THRESHOLD && (
        <JumpNumberField
          label="跳到曲序，按回车打开"
          placeholder="跳到曲序"
          onJump={jump}
          scrollOnChange
          withSearchIcon
        />
      )}

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {!tracks.length && <p className="px-2.5 py-2 text-sm text-fg-muted">还没有曲目，先新增第 1 首。</p>}
        <ul className="space-y-0.5">
          {tracks.map((track) => {
            const selected = current.type === "music" && current.id === track.id;
            return (
              <li key={track.id}>
                <Link
                  href={albumMediaHref("music", track.id)}
                  data-track={track.id}
                  aria-current={selected ? "page" : undefined}
                  className={`flex min-h-9 items-center gap-2.5 rounded-lg border px-2.5 text-[13px] transition-colors ${selected ? "border-[var(--accent-border)] bg-[var(--accent-soft)] font-medium text-[var(--accent-light)]" : "border-transparent text-fg-secondary hover:bg-white/5 hover:text-white"}`}
                >
                  <span
                    className={`min-w-6 font-mono text-xs ${selected ? "text-[var(--accent-light)]" : "text-fg-muted"}`}
                  >
                    {trackLabel(track.number)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{track.title}</span>
                  <span className="font-mono text-[11px] text-fg-muted">{formatSeconds(track.durationSeconds)}</span>
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
      <p className="flex gap-3.5 px-1 text-[11px] text-fg-muted" aria-hidden="true">
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
