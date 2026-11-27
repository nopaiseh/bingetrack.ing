import Image from "next/image";
import Link from "next/link";
import LetterTile from "@/components/LetterTile";
import { albumReleaseKindLabel, formatTrackDuration } from "@/lib/album-display";
import { publicMediaDetailPath, publicPathForDbType } from "@/lib/media-types";
import type { SongAlbumMembership } from "@/lib/types/song";

function yearOf(date: string | null): string {
  return String(date ?? "").match(/\d{4}/)?.[0] ?? "";
}

/** 与页头一致：元信息项之间用「·」分隔。 */
function MetaLine({ items }: { items: readonly (string | null | undefined)[] }) {
  const visible = items.filter((item): item is string => Boolean(item));
  if (visible.length === 0) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
      {visible.flatMap((item, index) => {
        const mono = /^\d{4}$/.test(item) || item.startsWith("曲序");
        const node = (
          <span key={`item-${index}`} className={mono ? "font-mono" : undefined}>
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
  );
}

/** 「收录于」专辑列表，并嵌套同专其他曲目（每专最多 20，后端已截断）。 */
export default function SongAlbumsSection({
  albums,
  currentSongId,
}: {
  albums: readonly SongAlbumMembership[];
  currentSongId: string;
}) {
  if (albums.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="song-albums-heading">
      <h2 id="song-albums-heading" className="mb-4 text-lg font-semibold text-fg">
        收录于
      </h2>
      <ul className="space-y-8">
        {albums.map((album) => {
          const albumHref = `${publicMediaDetailPath("albums", album.id)}?from=${encodeURIComponent(`/music/${currentSongId}`)}`;
          const year = yearOf(album.release_date);
          const kindLabel = albumReleaseKindLabel(album.release_kind);
          const trackPos =
            album.track_number != null
              ? album.disc_number != null && album.disc_number > 1
                ? `${album.disc_number}-${album.track_number}`
                : String(album.track_number)
              : null;

          return (
            <li key={album.id} className="min-w-0">
              <div className="flex items-start gap-3 sm:gap-4">
                <Link
                  href={albumHref}
                  className="focus-ring relative block aspect-square w-14 shrink-0 overflow-hidden rounded-lg sm:w-16"
                  aria-label={`专辑《${album.title}》`}
                >
                  {album.cover_url ? (
                    <Image src={album.cover_url} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    <LetterTile title={album.title} decorative />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={albumHref}
                    className="focus-ring rounded text-base font-medium text-fg underline-offset-4 hover:underline"
                  >
                    {album.title}
                  </Link>
                  <MetaLine items={[year || null, kindLabel, trackPos != null ? `曲序 ${trackPos}` : null]} />
                </div>
              </div>

              {album.other_tracks.length > 0 ? (
                <div className="mt-4 border-l border-[var(--border)] pl-4 sm:ml-[4.5rem] sm:pl-0 sm:border-l-0">
                  <h3 className="mb-2 text-sm font-medium text-fg-muted">同专其他曲目</h3>
                  <ol className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                    {album.other_tracks.map((track) => {
                      const href = `${publicPathForDbType("music", track.id)}?from=${encodeURIComponent(`/music/${currentSongId}`)}`;
                      const duration = formatTrackDuration(track.duration_seconds);
                      const num =
                        track.track_number != null
                          ? track.disc_number != null && track.disc_number > 1
                            ? `${track.disc_number}-${track.track_number}`
                            : String(track.track_number)
                          : "—";
                      return (
                        <li key={track.id} className="flex items-baseline gap-3 px-3 py-2.5 text-sm">
                          <span className="w-10 shrink-0 font-mono text-fg-muted">{num}</span>
                          <Link
                            href={href!}
                            className="focus-ring min-w-0 flex-1 rounded font-medium text-fg underline-offset-4 hover:underline"
                          >
                            {track.title}
                          </Link>
                          <span className="shrink-0 font-mono text-fg-secondary">{duration ?? "—"}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
