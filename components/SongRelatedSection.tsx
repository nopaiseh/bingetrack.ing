import Image from "next/image";
import Link from "next/link";
import LetterTile from "@/components/LetterTile";
import { buildRelatedSongRelationLabel } from "@/lib/song/related-label";
import { publicPathForDbType } from "@/lib/media-types";
import type { RelatedSong } from "@/lib/types/song";

function yearOf(date: string | null): string {
  return String(date ?? "").match(/\d{4}/)?.[0] ?? "";
}

/** 相关歌曲：单一扁平列表；关系标签由 relations 数组生成。 */
export default function SongRelatedSection({
  related,
  currentSongId,
}: {
  related: readonly RelatedSong[];
  currentSongId: string;
}) {
  if (related.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="song-related-heading">
      <h2 id="song-related-heading" className="mb-4 text-lg font-semibold text-fg">
        相关歌曲
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((song) => {
          const href = `${publicPathForDbType("music", song.id)}?from=${encodeURIComponent(`/music/${currentSongId}`)}`;
          const relation = buildRelatedSongRelationLabel(song.relations);
          const year = yearOf(song.release_date);
          return (
            <li key={song.id}>
              <Link
                href={href!}
                className="focus-ring surface-control interactive-control flex items-center gap-3 rounded-xl p-2.5"
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
    </section>
  );
}
