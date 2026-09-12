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
