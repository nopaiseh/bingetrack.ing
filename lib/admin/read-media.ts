import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaInput } from "./media-form";

/** 并行读取编辑字段和关系，任何失败都终止，避免用空表单覆盖真实关联。 */
export async function readEditableMedia(db: SupabaseClient, id: string): Promise<MediaInput | null> {
  const results = await Promise.all([
    db.from("media_items").select("*").eq("id", id).maybeSingle(),
    db.from("tracking").select("status,rating").eq("media_item_id", id).maybeSingle(),
    db.from("tv_seasons").select("series_id,season_number").eq("id", id).maybeSingle(),
    db.from("tv_episodes").select("season_id,episode_number").eq("id", id).maybeSingle(),
    db.from("media_genres").select("genres(name)").eq("media_item_id", id),
    db.from("media_languages").select("languages(name)").eq("media_item_id", id),
    db.from("media_regions").select("regions(name)").eq("media_item_id", id),
    db.from("media_credits").select("role,people(name)").eq("media_item_id", id).order("credit_order"),
  ]);
  if (results.some(/* 任一失败均禁止继续编辑。 */ result => result.error)) throw new Error("无法完整读取媒体资料，请重试。");
  const [media, tracking, season, episode, genres, languages, regions, credits] = results;
  if (!media.data) return null;
  /** Supabase 多对一关联在此按数据库外键返回单个对象。 */
  function names(data: unknown, key: string, role?: string): string[] {
    return (data as Record<string, unknown>[]).filter(/* 人物关联按角色分别展示。 */ row => !role || row.role === role).map(/* 提取关联对象名称。 */ row => (row[key] as { name: string }).name);
  }
  return { ...media.data, parent_id: season.data?.series_id ?? episode.data?.season_id ?? null,
    number: season.data?.season_number ?? episode.data?.episode_number ?? null,
    status: tracking.data?.status ?? "want_to_watch", rating: tracking.data?.rating ?? null,
    genres: names(genres.data, "genres"), languages: names(languages.data, "languages"), regions: names(regions.data, "regions"),
    actors: names(credits.data, "people", "actor"), directors: names(credits.data, "people", "director") } as MediaInput;
}
