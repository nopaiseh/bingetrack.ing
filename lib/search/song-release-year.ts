/**
 * 单曲公开搜索年份口径，与 public.release_year_stats 曲目列一致：
 * coalesce(song.release_date, album.release_date)；二者皆无则不计。
 * 搜索层对 v_all_media 使用 first_air_date／last_air_date（迁移后已写入同一 coalesce 值）。
 */

export type SongSearchRow = {
  /** 曲目自身 media_items.release_date。 */
  releaseDate: string | null;
  /** 所属专辑 media_items.release_date；独立单曲为 null。 */
  albumReleaseDate: string | null;
  /** tracking.status；无记录为 null（不算听过／想听）。 */
  status: "watched" | "want_to_watch" | "watching" | "in_progress" | null;
};

/** 有效发行日：自身优先，否则专辑；与 stats 视图 coalesce 一致。 */
export function songEffectiveReleaseDate(song: Pick<SongSearchRow, "releaseDate" | "albumReleaseDate">): string | null {
  return song.releaseDate ?? song.albumReleaseDate;
}

/** 有效发行年；无有效日返回 null（对应 stats 不计该曲）。 */
export function songEffectiveReleaseYear(song: Pick<SongSearchRow, "releaseDate" | "albumReleaseDate">): number | null {
  const date = songEffectiveReleaseDate(song);
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/**
 * 是否落入搜索年份区间（与 media-repo 对 last_air_date／first_air_date 的 gte／lte 一致）。
 * 未传起止年时不过滤日期（含无日期曲目仍可出现在无年份的搜索里）。
 */
export function songMatchesSearchYear(
  song: Pick<SongSearchRow, "releaseDate" | "albumReleaseDate">,
  startYear?: string,
  endYear?: string,
): boolean {
  if (!startYear && !endYear) return true;
  const effective = songEffectiveReleaseDate(song);
  if (!effective) return false;
  if (startYear && effective < `${startYear}-01-01`) return false;
  if (endYear && effective > `${endYear}-12-31`) return false;
  return true;
}

/** 是否命中搜索 status.in(...)；空列表表示不限状态。 */
export function songMatchesSearchStatus(song: Pick<SongSearchRow, "status">, statuses: readonly string[]): boolean {
  if (statuses.length === 0) return true;
  return song.status != null && statuses.includes(song.status);
}

/**
 * 按日历年（或 All Time）汇总曲目三列，口径对齐 release_year_stats：
 * total_tracks／listened_tracks（watched）／want_tracks（want_to_watch）。
 */
export function countTracksForReleaseYear(
  songs: readonly SongSearchRow[],
  year: number | "All Time",
): { total_tracks: number; listened_tracks: number; want_tracks: number } {
  const inYear = songs.filter((song) => {
    const effectiveYear = songEffectiveReleaseYear(song);
    if (effectiveYear == null) return false;
    return year === "All Time" || effectiveYear === year;
  });
  return {
    total_tracks: inYear.length,
    listened_tracks: inYear.filter((song) => song.status === "watched").length,
    want_tracks: inYear.filter((song) => song.status === "want_to_watch").length,
  };
}

/**
 * 模拟 type=music 且给定 startYear／endYear／status 时的搜索命中数。
 * 年份有值时排除无有效日曲目，与 PostgREST 日期比较排除 NULL 的行为一致。
 */
export function countSongsMatchingSearch(
  songs: readonly SongSearchRow[],
  opts: { startYear?: string; endYear?: string; status?: readonly string[] },
): number {
  const statuses = opts.status ?? [];
  return songs.filter(
    (song) => songMatchesSearchYear(song, opts.startYear, opts.endYear) && songMatchesSearchStatus(song, statuses),
  ).length;
}
