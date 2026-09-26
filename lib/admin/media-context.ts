import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Choice } from "./catalog";

/** 读取真实上级名称及编号建议，避免让用户输入数据库 ID。 */
export async function readParent(db: SupabaseClient, id: string): Promise<Choice | undefined> {
  if (!id) return undefined;
  const { data, error } = await db.from("media_items").select("id,title,type").eq("id", id).maybeSingle();
  if (error) throw new Error("无法读取上级资料。");
  return data ? { id: data.id, name: data.title, detail: data.type } : undefined;
}
/** 使用精确计数显示删除范围，不把数据库的返回行数上限当成实际数量。 */
export async function readImpact(db: SupabaseClient, id: string, type: string) {
  if (type !== "tv_series" && type !== "tv_season") return { seasons: 0, episodes: 0 };
  const seasonQuery = type === "tv_series" ? db.from("tv_seasons").select("id", { count: "exact", head: true }).eq("series_id", id) : Promise.resolve({ count: 0, error: null });
  const episodeQuery = type === "tv_series" ? db.from("tv_episodes").select("id,tv_seasons!tv_episodes_season_id_fkey!inner(series_id)", { count: "exact", head: true }).eq("tv_seasons.series_id", id) : db.from("tv_episodes").select("id", { count: "exact", head: true }).eq("season_id", id);
  const [seasons, episodes] = await Promise.all([seasonQuery, episodeQuery]);
  if (seasons.error || episodes.error) throw new Error("无法核对下属内容数量，请重试。");
  return { seasons: seasons.count ?? 0, episodes: episodes.count ?? 0 };
}

export type Sibling = { id: string; title: string; number: number; season?: number };

type SiblingTable = "tv_seasons" | "tv_episodes";

/** 读取某上级下指定方向上编号最接近的一条；不传编号时读取首条或末条。 */
async function readNeighbour(db: SupabaseClient, table: SiblingTable, parentId: string, ascending: boolean, number?: number): Promise<Sibling | undefined> {
  const parentColumn = table === "tv_seasons" ? "series_id" : "season_id";
  const numberColumn = table === "tv_seasons" ? "season_number" : "episode_number";
  let query = db.from(table).select(`id,${numberColumn},media:media_items!${table}_id_fkey(title)`).eq(parentColumn, parentId);
  if (number != null) query = ascending ? query.gt(numberColumn, number) : query.lt(numberColumn, number);
  const { data, error } = await query.order(numberColumn, { ascending }).limit(1).maybeSingle();
  if (error) throw new Error("无法读取相邻条目。");
  if (!data) return undefined;
  // 兼容 PostgREST 以对象或数组返回的一对一关系。
  const record = data as unknown as { id: string; media: { title: string } | { title: string }[] | null } & Record<string, unknown>;
  const media = Array.isArray(record.media) ? record.media[0] : record.media;
  return { id: record.id, title: media?.title ?? "", number: Number(record[numberColumn]) };
}

/** 本季已到首集或末集时，沿季号顺序找到最近一个有单集的季，取其末集或首集。 */
async function readAcrossSeasons(db: SupabaseClient, seasons: { id: string; season_number: number }[], ascending: boolean): Promise<Sibling | undefined> {
  for (const season of ascending ? seasons : [...seasons].reverse()) {
    const episode = await readNeighbour(db, "tv_episodes", season.id, ascending);
    if (episode) return { ...episode, season: season.season_number };
  }
  return undefined;
}

/** 读取紧邻的前后条目方便连续编辑：剧季限同一剧集，单集可跨季衔接。 */
export async function readSiblings(db: SupabaseClient, type: string, parentId: string | null | undefined, number: number | null | undefined): Promise<{ previous?: Sibling; next?: Sibling }> {
  if ((type !== "tv_season" && type !== "tv_episode") || !parentId || number == null) return {};
  const table = type === "tv_season" ? "tv_seasons" : "tv_episodes";
  const [previous, next] = await Promise.all([readNeighbour(db, table, parentId, false, number), readNeighbour(db, table, parentId, true, number)]);
  if (type === "tv_season" || (previous && next)) return { previous, next };

  const current = await db.from("tv_seasons").select("series_id,season_number").eq("id", parentId).maybeSingle();
  if (current.error) throw new Error("无法读取相邻条目。");
  if (!current.data) return { previous, next };
  const { series_id: seriesId, season_number: seasonNumber } = current.data;
  const [earlier, later] = await Promise.all([
    previous ? null : db.from("tv_seasons").select("id,season_number").eq("series_id", seriesId).lt("season_number", seasonNumber).order("season_number"),
    next ? null : db.from("tv_seasons").select("id,season_number").eq("series_id", seriesId).gt("season_number", seasonNumber).order("season_number"),
  ]);
  if (earlier?.error || later?.error) throw new Error("无法读取相邻条目。");
  const [crossPrevious, crossNext] = await Promise.all([
    earlier ? readAcrossSeasons(db, earlier.data ?? [], false) : undefined,
    later ? readAcrossSeasons(db, later.data ?? [], true) : undefined,
  ]);
  return { previous: previous ?? crossPrevious, next: next ?? crossNext };
}
