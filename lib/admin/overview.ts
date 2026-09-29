import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reports, type ReportKind } from "./reports";
import { suggestNextEpisode, type NextEpisode, type StructureEpisode } from "./series-structure";

const DAY = 86_400_000;
/** 「待录入」只看最近这些天有播出的节目。 */
export const RECENT_DAYS = 30;

export type LibraryCounts = { movie: number; tv_show: number; tv_episode: number; people: number };
export type AiringShow = {
  id: string;
  title: string;
  coverUrl: string | null;
  lastAired: string;
  season: number | null;
  lastEpisode: { number: number; title: string } | null;
  next: NextEpisode;
  /** 按间隔推算的下一集日期已到，却还没录入。 */
  overdue: boolean;
};

/** 精确计数片库规模，只取数量不读行。 */
export async function readLibraryCounts(db: SupabaseClient): Promise<LibraryCounts> {
  const [movie, show, episode, people] = await Promise.all([
    db.from("media_items").select("id", { count: "exact", head: true }).eq("type", "movie"),
    db.from("media_items").select("id", { count: "exact", head: true }).eq("type", "tv_show"),
    db.from("media_items").select("id", { count: "exact", head: true }).eq("type", "tv_episode"),
    db.from("people").select("id", { count: "exact", head: true }),
  ]);
  if (movie.error || show.error || episode.error || people.error) throw new Error("无法读取片库统计，请重试。");
  return { movie: movie.count ?? 0, tv_show: show.count ?? 0, tv_episode: episode.count ?? 0, people: people.count ?? 0 };
}

/** 并行统计各报告数量；单份失败记为 null，不影响其他报告。 */
export async function readReportCounts(db: SupabaseClient): Promise<Map<ReportKind, number | null>> {
  const kinds = Object.keys(reports) as ReportKind[];
  const results = await Promise.all(kinds.map(/* 只取数量，不读取行。 */ kind => db.from(reports[kind].view).select("id", { count: "exact", head: true })));
  return new Map(kinds.map((kind, index) => [kind, results[index].error ? null : results[index].count ?? 0]));
}

/** PostgREST 对一对一关系可能返回对象或数组，统一取第一项。 */
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** 往前看的单集数：整批上线时需越过同一天的多集，才能找到上一个播出日期。 */
const LOOKBACK = 20;

/** 读取一个节目编号最大的季及其最近若干集，用于推算下一集。 */
async function readLatest(db: SupabaseClient, showId: string) {
  const season = await db.from("tv_seasons").select("id,season_number").eq("series_id", showId).order("season_number", { ascending: false }).limit(1).maybeSingle();
  if (season.error) throw new Error("无法读取待录入节目，请重试。");
  if (!season.data) return { season: null, episodes: [] as StructureEpisode[] };
  type Row = { id: string; episode_number: number; media: { title: string; release_date: string | null; runtime: number | string | null } | { title: string; release_date: string | null; runtime: number | string | null }[] | null };
  const episodes = await db.from("tv_episodes").select("id,episode_number,media:media_items!tv_episodes_id_fkey(title,release_date,runtime)").eq("season_id", season.data.id).order("episode_number", { ascending: false }).limit(LOOKBACK);
  if (episodes.error) throw new Error("无法读取待录入节目，请重试。");
  const rows = (episodes.data as unknown as Row[]).map(row => {
    const media = one(row.media);
    return { id: row.id, number: Number(row.episode_number), title: media?.title ?? "", watched: false, releaseDate: media?.release_date ?? null, runtime: media?.runtime != null ? Number(media.runtime) : null };
  }).reverse();
  return { season: Number(season.data.season_number), episodes: rows };
}

/** 最近有播出的电视节目：推算的下一集已到期的排在前面，其次按最近播出日期倒序。today 为 YYYY-MM-DD。 */
export async function readAiringShows(db: SupabaseClient, today: string, limit = 8): Promise<AiringShow[]> {
  const since = new Date(Date.parse(today) - RECENT_DAYS * DAY).toISOString().slice(0, 10);
  const recent = await db.from("v_manage_media_order").select("id,title,sort_date").eq("type", "tv_show").gte("sort_date", since).lte("sort_date", today).order("sort_date", { ascending: false }).order("id").limit(limit);
  if (recent.error) throw new Error("无法读取待录入节目，请重试。");
  const rows = (recent.data ?? []) as { id: string; title: string; sort_date: string }[];
  if (!rows.length) return [];
  const covers = await db.from("media_items").select("id,cover_url").in("id", rows.map(row => row.id));
  if (covers.error) throw new Error("无法读取待录入节目，请重试。");
  const coverById = new Map((covers.data ?? []).map(row => [row.id as string, row.cover_url as string | null]));
  const latest = await Promise.all(rows.map(row => readLatest(db, row.id)));
  const shows = rows.map((row, index) => {
    const { season, episodes } = latest[index];
    const last = episodes.at(-1);
    const next = suggestNextEpisode(episodes);
    return {
      id: row.id,
      title: row.title,
      coverUrl: coverById.get(row.id) ?? null,
      lastAired: row.sort_date,
      season,
      lastEpisode: last ? { number: last.number, title: last.title } : null,
      next,
      overdue: Boolean(next.releaseDate && next.releaseDate <= today),
    };
  });
  return shows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.lastAired.localeCompare(a.lastAired));
}
