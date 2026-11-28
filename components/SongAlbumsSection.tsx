import Image from "next/image";
import Link from "next/link";
import LetterTile from "@/components/LetterTile";
import { albumReleaseKindLabel, formatTrackDuration } from "@/lib/album-display";
import { publicMediaDetailPath, publicPathForDbType } from "@/lib/media-types";
import { buildAlbumPanelTracks, formatAlbumTrackNumber } from "@/lib/song/album-tracklist";
import type { SongAlbumMembership, SongDetail } from "@/lib/types/song";

function yearOf(date: string | null): string {
  return String(date ?? "").match(/\d{4}/)?.[0] ?? "";
}

function AlbumPanel({
  album,
  song,
}: {
  album: SongAlbumMembership;
  song: Pick<SongDetail, "id" | "title" | "duration_seconds">;
}) {
  const albumHref = `${publicMediaDetailPath("albums", album.id)}?from=${encodeURIComponent(`/music/${song.id}`)}`;
  const year = yearOf(album.release_date);
  const kindLabel = albumReleaseKindLabel(album.release_kind);
  const meta = [year || null, kindLabel].filter((item): item is string => Boolean(item));
  const tracks = buildAlbumPanelTracks(album, {
    id: song.id,
    title: song.title,
    duration_seconds: song.duration_seconds,
  });

  return (
    <article className="surface-panel rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Link
          href={albumHref}
          className="focus-ring relative block aspect-square w-14 shrink-0 overflow-hidden rounded-lg"
          aria-label={`专辑《${album.title}》`}
        >
          {album.cover_url ? (
            <Image src={album.cover_url} alt="" fill sizes="56px" className="object-cover" />
          ) : (
            <LetterTile title={album.title} decorative />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">收录于</p>
          <Link
            href={albumHref}
            className="focus-ring mt-0.5 block rounded text-base font-semibold text-fg underline-offset-4 hover:underline"
          >
            {album.title}
          </Link>
          {meta.length > 0 ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
              {meta.flatMap((item, index) => {
                const node = (
                  <span key={`item-${index}`} className={/^\d{4}$/.test(item) ? "font-mono" : undefined}>
                    {item}
                  </span>
                );
                if (index === 0) return [node];
                return [
                  <span key={`dot-${index}`} aria-hidden="true" className="text-fg-subtle">
                    ·
                  </span>,
                  node,
                ];
              })}
            </p>
          ) : null}
        </div>
      </div>

      {tracks.length > 0 ? (
        <ol className="mt-4 divide-y divide-[var(--border)] border-t border-[var(--border)]" aria-label="曲目">
          {tracks.map((track) => {
            const num = formatAlbumTrackNumber(track);
            const duration = formatTrackDuration(track.duration_seconds);
            const rowClass = track.isCurrent
              ? "flex min-h-11 items-center gap-3 border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-sm"
              : "flex min-h-11 items-center gap-3 border-l-2 border-transparent px-3 py-1.5 text-sm";

            if (track.isCurrent) {
              return (
                <li key={track.id} className={rowClass} aria-current="true">
                  <span className="w-8 shrink-0 font-mono text-fg-muted">{num}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-fg">{track.title}</span>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-hover)]">
                    当前
                  </span>
                  {duration ? <span className="shrink-0 font-mono text-fg-secondary">{duration}</span> : null}
                </li>
              );
            }

            const href = `${publicPathForDbType("music", track.id)}?from=${encodeURIComponent(`/music/${song.id}`)}`;
            return (
              <li key={track.id}>
                <Link
                  href={href!}
                  className={`focus-ring ${rowClass} rounded-r transition-colors hover:bg-[var(--surface-3)]`}
                >
                  <span className="w-8 shrink-0 font-mono text-fg-muted">{num}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-fg">{track.title}</span>
                  {duration ? <span className="shrink-0 font-mono text-fg-secondary">{duration}</span> : null}
                </Link>
              </li>
            );
          })}
        </ol>
      ) : null}

      <Link
        href={albumHref}
        className="focus-ring mt-4 inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent-hover)] underline-offset-4 hover:underline"
      >
        查看整张专辑 ›
      </Link>
    </article>
  );
}

/** 右侧／移动端专辑面板：每张收录专辑一块，内嵌曲目列表（含当前曲高亮）。 */
export default function SongAlbumsSection({
  albums,
  song,
}: {
  albums: readonly SongAlbumMembership[];
  song: Pick<SongDetail, "id" | "title" | "duration_seconds">;
}) {
  if (albums.length === 0) return null;

  return (
    <section className="space-y-4" aria-label="收录于">
      {albums.map((album) => (
        <AlbumPanel key={album.id} album={album} song={song} />
      ))}
    </section>
  );
}
