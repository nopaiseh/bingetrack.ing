import type { SongAlbumMembership, SongAlbumOtherTrack } from "@/lib/types/song";

/** 曲目排序键：碟号／曲序缺失时靠后，便于稳定插入当前曲。 */
export function trackSortKey(track: { disc_number: number | null; track_number: number | null }): [number, number] {
  return [track.disc_number ?? Number.POSITIVE_INFINITY, track.track_number ?? Number.POSITIVE_INFINITY];
}

function compareTracks(
  a: { disc_number: number | null; track_number: number | null },
  b: { disc_number: number | null; track_number: number | null },
): number {
  const [ad, at] = trackSortKey(a);
  const [bd, bt] = trackSortKey(b);
  if (ad !== bd) return ad - bd;
  return at - bt;
}

export type AlbumPanelTrack = SongAlbumOtherTrack & { isCurrent: boolean };

/**
 * 用 other_tracks（后端最多 20）加上当前曲，按碟号／曲序排序。
 * 当前曲已在列表中则只标记 isCurrent；否则按序插入（超出范围则落在末尾）。
 * 不补造缺失曲目，不展示总曲目数。
 */
export function buildAlbumPanelTracks(
  album: Pick<SongAlbumMembership, "disc_number" | "track_number" | "other_tracks">,
  current: { id: string; title: string; duration_seconds: number | null },
): AlbumPanelTrack[] {
  const others = album.other_tracks.map((track) => ({ ...track, isCurrent: false as const }));
  const existingIndex = others.findIndex((track) => track.id === current.id);
  if (existingIndex >= 0) {
    return others
      .map((track, index) => (index === existingIndex ? { ...track, isCurrent: true } : track))
      .sort(compareTracks);
  }

  const currentRow: AlbumPanelTrack = {
    id: current.id,
    title: current.title,
    disc_number: album.disc_number,
    track_number: album.track_number,
    duration_seconds: current.duration_seconds,
    isCurrent: true,
  };

  return [...others, currentRow].sort(compareTracks);
}

/** 曲序号展示：多碟用「碟-曲」，单碟或无碟号只用曲序。 */
export function formatAlbumTrackNumber(track: { disc_number: number | null; track_number: number | null }): string {
  if (track.track_number == null) return "—";
  if (track.disc_number != null && track.disc_number > 1) {
    return `${track.disc_number}-${track.track_number}`;
  }
  return String(track.track_number);
}
