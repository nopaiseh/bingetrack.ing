/** 拥有权：与收听追踪独立；公开可读。 */
export type OwnershipStatus = "want_to_own" | "owned";

/**
 * 专辑曲目数：有实际曲目时以实际数为准；没有曲目时才回退到
 * music_albums.track_count（表示已知总曲目数但尚未录入）。
 * 两边都没有时返回 null。
 */
export function resolveAlbumTrackCount(
  actualTrackCount: number,
  storedTrackCount: number | null | undefined,
): number | null {
  if (Number.isFinite(actualTrackCount) && actualTrackCount > 0) return Math.trunc(actualTrackCount);
  if (storedTrackCount == null) return null;
  const stored = Number(storedTrackCount);
  if (!Number.isFinite(stored) || stored < 0) return null;
  return Math.trunc(stored);
}

/** 曲目时长：runtime 按秒格式化为 m:ss；不足一秒或非法返回 null。 */
export function formatTrackDuration(runtimeSeconds: number | null | undefined): string | null {
  if (runtimeSeconds == null || !Number.isFinite(runtimeSeconds) || runtimeSeconds < 1) return null;
  const total = Math.round(runtimeSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** 拥有权中文标签。 */
export function ownershipLabel(status: OwnershipStatus | null | undefined): string | null {
  if (status === "owned") return "已拥有";
  if (status === "want_to_own") return "想拥有";
  return null;
}

/** 与 public.album_release_kind 枚举对齐。 */
export type AlbumReleaseKind = "album" | "ep" | "single" | "compilation";

/** 发行形态中文／惯用标签；未知值返回 null（不原样露出英文枚举）。 */
export const ALBUM_RELEASE_KIND_LABELS: Record<AlbumReleaseKind, string> = {
  album: "专辑",
  ep: "EP",
  single: "单曲",
  compilation: "精选集",
};

/** music_albums.release_kind → 展示文案。 */
export function albumReleaseKindLabel(kind: string | null | undefined): string | null {
  if (!kind) return null;
  if (Object.hasOwn(ALBUM_RELEASE_KIND_LABELS, kind)) {
    return ALBUM_RELEASE_KIND_LABELS[kind as AlbumReleaseKind];
  }
  return null;
}
