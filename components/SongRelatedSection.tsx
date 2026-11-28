"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import LetterTile from "@/components/LetterTile";
import { buildRelatedSongRelationLabel } from "@/lib/song/related-label";
import { publicPathForDbType } from "@/lib/media-types";
import type { RelatedSong } from "@/lib/types/song";

/** 首屏展示条数；其余用「展开全部」揭示（接口最多 12）。 */
export const RELATED_SONGS_PREVIEW_COUNT = 6;

function yearOf(date: string | null): string {
  return String(date ?? "").match(/\d{4}/)?.[0] ?? "";
}

/** 相关歌曲：两列卡片；默认前 6 首，可展开全部。 */
export default function SongRelatedSection({
  related,
  currentSongId,
}: {
  related: readonly RelatedSong[];
  currentSongId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (related.length === 0) return null;

  const needsToggle = related.length > RELATED_SONGS_PREVIEW_COUNT;
  const visible = expanded || !needsToggle ? related : related.slice(0, RELATED_SONGS_PREVIEW_COUNT);

  return (
    <section aria-labelledby="song-related-heading">
      <h2 id="song-related-heading" className="mb-4 text-lg font-semibold text-fg">
        相关歌曲
      </h2>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visible.map((song) => {
          const href = `${publicPathForDbType("music", song.id)}?from=${encodeURIComponent(`/music/${currentSongId}`)}`;
          const relation = buildRelatedSongRelationLabel(song.relations);
          const year = yearOf(song.release_date);
          return (
            <li key={song.id}>
              <Link
                href={href!}
                className="focus-ring surface-control interactive-control flex min-h-11 items-center gap-3 rounded-xl p-2.5"
              >
                <span className="relative aspect-square w-14 shrink-0 overflow-hidden rounded-lg">
                  {song.cover_url ? (
                    <Image src={song.cover_url} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <LetterTile title={song.title} decorative />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg">{song.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                    {relation ? <span>{relation}</span> : null}
                    {year ? <span className="font-mono">{year}</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {needsToggle ? (
        <button
          type="button"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent-hover)]"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "收起" : "展开全部"}
        </button>
      ) : null}
    </section>
  );
}
