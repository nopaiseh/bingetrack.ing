import MediaRatingBadge from "@/components/MediaRatingBadge";
import { formatTrackDuration } from "@/lib/album-display";
import type { AlbumTrack } from "@/lib/types/album";
import { listenStatusLabel } from "@/lib/listen-status";

function joinNames(names: readonly string[]): string {
  return names.filter(Boolean).join("、") || "—";
}

/** 专辑曲目表：桌面完整列；手机把作词／作曲收到标题下第二行。 */
export default function AlbumTracklist({ tracks }: { tracks: readonly AlbumTrack[] }) {
  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
        <p className="text-sm text-fg-muted">这张专辑还没有曲目。</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <table className="w-full min-w-0 border-collapse text-left text-sm">
        <caption className="sr-only">曲目列表</caption>
        <thead className="border-b border-[var(--border)] bg-[var(--surface-panel)] text-fg-muted">
          <tr>
            <th scope="col" className="w-10 px-3 py-3 font-medium sm:px-4">
              #
            </th>
            <th scope="col" className="px-3 py-3 font-medium sm:px-4">
              曲目
            </th>
            <th scope="col" className="hidden px-3 py-3 font-medium md:table-cell md:px-4">
              演唱
            </th>
            <th scope="col" className="hidden px-3 py-3 font-medium lg:table-cell lg:px-4">
              作词
            </th>
            <th scope="col" className="hidden px-3 py-3 font-medium lg:table-cell lg:px-4">
              作曲
            </th>
            <th scope="col" className="w-16 px-3 py-3 font-medium sm:px-4">
              时长
            </th>
            <th scope="col" className="w-16 px-3 py-3 font-medium sm:px-4">
              状态
            </th>
            <th scope="col" className="w-20 px-3 py-3 font-medium sm:px-4">
              评分
            </th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track) => {
            const duration = formatTrackDuration(track.durationSeconds);
            const status = listenStatusLabel(track.status);
            const creditsLine = [
              track.lyricists.length ? `词 ${joinNames(track.lyricists)}` : null,
              track.composers.length ? `曲 ${joinNames(track.composers)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <tr key={track.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-white/[0.03]">
                <td className="px-3 py-3 align-top font-mono text-fg-muted sm:px-4">
                  {track.trackNumber ?? "—"}
                </td>
                <td className="min-w-0 px-3 py-3 align-top sm:px-4">
                  <div className="font-medium text-fg">{track.title}</div>
                  <div className="mt-0.5 text-xs text-fg-muted md:hidden">{joinNames(track.singers)}</div>
                  {creditsLine ? (
                    <div className="mt-0.5 text-xs text-fg-subtle lg:hidden">{creditsLine}</div>
                  ) : null}
                </td>
                <td className="hidden min-w-0 px-3 py-3 align-top text-fg-secondary md:table-cell md:px-4">
                  {joinNames(track.singers)}
                </td>
                <td className="hidden min-w-0 px-3 py-3 align-top text-fg-secondary lg:table-cell lg:px-4">
                  {joinNames(track.lyricists)}
                </td>
                <td className="hidden min-w-0 px-3 py-3 align-top text-fg-secondary lg:table-cell lg:px-4">
                  {joinNames(track.composers)}
                </td>
                <td className="px-3 py-3 align-top font-mono text-fg-secondary sm:px-4">{duration ?? "—"}</td>
                <td className="px-3 py-3 align-top text-fg-secondary sm:px-4">{status ?? "—"}</td>
                <td className="px-3 py-3 align-top sm:px-4">
                  {track.rating != null ? (
                    <MediaRatingBadge rating={track.rating} size="sm" showTier={false} />
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
