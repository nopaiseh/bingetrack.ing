import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManagedMediaType } from "./media-form";

export type WatchStatus = "watched" | "watching" | "want_to_watch";
export type StructureEpisode = { id: string; number: number; title: string; watched: boolean; releaseDate: string | null; runtime: number | null };
export type StructureSeason = { id: string; number: number; title: string; episodeCount: number; status: WatchStatus };
/** 新增下一集的预填值：编号接续末集，日期按最近两集的间隔推算，时长沿用末集。 */
export type NextEpisode = { number: number; releaseDate: string | null; runtime: number | null; afterTitle: string | null };
export type SeriesStructure = {
  show: { id: string; title: string; alternateTitle: string | null; coverUrl: string | null; status: WatchStatus; rating: number | null };
  seasons: StructureSeason[];
  /** 展开的季：编辑季时为该季，编辑单集时为所属季，编辑节目时为编号最大的季。 */
  expandedSeasonId: string | null;
  episodes: StructureEpisode[];
  totalEpisodes: number;
  nextSeasonNumber: number;
  nextEpisode: NextEpisode | null;
};

const EPISODE_CHUNK = 1000;
const DAY = 86_400_000;

/** 按最近两个有日期的单集推算间隔，只有一个日期时按每周播出；日期跨度异常时不推算。 */
export function suggestNextEpisode(episodes: StructureEpisode[]): NextEpisode {
  const last = episodes.at(-1);
  const dated = episodes.filter(episode => episode.releaseDate);
  let releaseDate: string | null = null;
  const latest = dated.at(-1)?.releaseDate;
  if (latest) {
    const previous = dated.at(-2)?.releaseDate;
    const gap = previous ? Math.round((Date.parse(latest) - Date.parse(previous)) / DAY) : 7;
    if (gap > 0 && gap <= 366) releaseDate = new Date(Date.parse(latest) + gap * DAY).toISOString().slice(0, 10);
  }
  return { number: Math.min(100000, (last?.number ?? 0) + 1), releaseDate, runtime: last?.runtime ?? null, afterTitle: last?.title ?? null };
}

/** 季的观看状态与列表、编辑页口径一致：全部看过为看过，部分看过为在看。 */
function seasonStatus(episodeCount: number, watchedCount: number): WatchStatus {
  if (episodeCount > 0 && watchedCount === episodeCount) return "watched";
  return watchedCount > 0 ? "watching" : "want_to_watch";
}

/** PostgREST 对一对一关系可能返回对象或数组，统一取第一项。 */
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** 分块读取一季的全部单集，长篇节目单季上千集也不会被行数上限截断。 */
async function readEpisodes(db: SupabaseClient, seasonId: string): Promise<StructureEpisode[]> {
  type Row = { id: string; episode_number: number; media: { title: string; release_date: string | null; runtime: number | string | null; tracking: { status: string } | { status: string }[] | null } | { title: string; release_date: string | null; runtime: number | string | null; tracking: { status: string } | { status: string }[] | null }[] | null };
  const episodes: StructureEpisode[] = [];
  for (let offset = 0; ; offset += EPISODE_CHUNK) {
    const { data, error } = await db.from("tv_episodes")
      .select("id,episode_number,media:media_items!tv_episodes_id_fkey(title,release_date,runtime,tracking(status))")
      .eq("season_id", seasonId).order("episode_number").order("id")
      .range(offset, offset + EPISODE_CHUNK - 1);
    if (error) throw new Error("无法读取剧集结构，请重试。");
    for (const row of data as unknown as Row[]) {
      const media = one(row.media);
      episodes.push({
        id: row.id,
        number: Number(row.episode_number),
        title: media?.title ?? "",
        watched: one(media?.tracking)?.status === "watched",
        releaseDate: media?.release_date ?? null,
        runtime: media?.runtime != null ? Number(media.runtime) : null,
      });
    }
    if (data.length < EPISODE_CHUNK) return episodes;
  }
}

/** 读取电视节目的季集结构，供编辑页侧栏浏览与就地新增；任一查询失败即报错，不把空结果当成真实结构。 */
export async function readSeriesStructure(db: SupabaseClient, item: { id: string; type: ManagedMediaType; parent_id: string | null }): Promise<SeriesStructure | null> {
  if (item.type === "movie") return null;
  let showId = item.type === "tv_show" ? item.id : item.type === "tv_season" ? item.parent_id : null;
  if (item.type === "tv_episode" && item.parent_id) {
    const { data, error } = await db.from("tv_seasons").select("series_id").eq("id", item.parent_id).maybeSingle();
    if (error) throw new Error("无法读取剧集结构，请重试。");
    showId = data?.series_id ?? null;
  }
  if (!showId) return null;

  const [show, summary, seasonRows] = await Promise.all([
    db.from("media_items").select("id,title,alternate_title,cover_url").eq("id", showId).maybeSingle(),
    db.from("v_all_media").select("status,rating").eq("id", showId).maybeSingle(),
    db.from("v_media_season_summaries").select("id,season_number,title,episode_count,watched_episode_count").eq("series_id", showId).order("season_number"),
  ]);
  if (show.error || summary.error || seasonRows.error) throw new Error("无法读取剧集结构，请重试。");
  if (!show.data) return null;

  const seasons: StructureSeason[] = (seasonRows.data ?? []).map(row => ({
    id: row.id,
    number: Number(row.season_number),
    title: row.title ?? `第 ${row.season_number} 季`,
    episodeCount: Number(row.episode_count ?? 0),
    status: seasonStatus(Number(row.episode_count ?? 0), Number(row.watched_episode_count ?? 0)),
  }));
  const expandedSeasonId = item.type === "tv_season" ? item.id : item.type === "tv_episode" ? item.parent_id : seasons.at(-1)?.id ?? null;
  const episodes = expandedSeasonId ? await readEpisodes(db, expandedSeasonId) : [];

  return {
    show: {
      id: show.data.id,
      title: show.data.title,
      alternateTitle: show.data.alternate_title ?? null,
      coverUrl: show.data.cover_url ?? null,
      status: (summary.data?.status as WatchStatus | undefined) ?? "want_to_watch",
      rating: summary.data?.rating != null ? Number(summary.data.rating) : null,
    },
    seasons,
    expandedSeasonId,
    episodes,
    totalEpisodes: seasons.reduce((sum, season) => sum + season.episodeCount, 0),
    nextSeasonNumber: Math.min(100000, (seasons.at(-1)?.number ?? 0) + 1),
    nextEpisode: expandedSeasonId ? suggestNextEpisode(episodes) : null,
  };
}
