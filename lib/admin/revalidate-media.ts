import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import { isMediaId } from "@/lib/functions/media-id";
import { MEDIA_LISTS_TAG, MEDIA_TAG, mediaItemTag } from "@/lib/functions/media-cache-tags";

// 目录页与站点地图直接查询数据库、不带数据缓存标签，只能按路径失效。
const UNTAGGED_PUBLIC_PATHS = ["/", "/movies", "/shows", "/sitemap.xml"];

/** 从查询结果中取出非空 ID 列；任一查询失败时返回 null。 */
function column<K extends string>(result: { data: Record<K, string | null>[] | null; error: unknown }, key: K): string[] | null {
  if (result.error) return null;
  return (result.data ?? []).flatMap(/* 保留非空 ID。 */ (row) => row[key] ? [row[key] as string] : []);
}

/**
 * 找出条目变更会波及的公开详情页：条目本身、季或单集所属的电视节目，以及这些条目所在作品系列的其他成员（详情页内嵌相关作品卡片）。
 * 保存前后各调用一次，才能覆盖移出系列或改换上级的情况。查询失败时返回 null，由调用方退回全站失效。
 */
export async function affectedMediaIds(db: SupabaseClient, ids: string[]): Promise<string[] | null> {
  const targets = ids.filter(isMediaId);
  if (targets.length === 0) return [];

  const [episodeRows, seasonRows] = await Promise.all([
    db.from("tv_episodes").select("season_id").in("id", targets),
    db.from("tv_seasons").select("series_id").in("id", targets),
  ]);
  const episodeSeasons = column(episodeRows, "season_id");
  const seasonShows = column(seasonRows, "series_id");
  if (!episodeSeasons || !seasonShows) return null;

  const episodeShows = episodeSeasons.length > 0
    ? column(await db.from("tv_seasons").select("series_id").in("id", episodeSeasons), "series_id")
    : [];
  if (!episodeShows) return null;

  const pages = [...new Set([...targets, ...seasonShows, ...episodeShows])];
  const collections = column(await db.from("media_item_series").select("series_id").in("media_item_id", pages), "series_id");
  if (!collections) return null;

  const members = collections.length > 0
    ? column(await db.from("media_item_series").select("media_item_id").in("series_id", [...new Set(collections)]), "media_item_id")
    : [];
  if (!members) return null;

  return [...new Set([...pages, ...members])];
}

/** 合并保存前后的受影响条目；任一侧未知时整体视为未知。 */
export function mergeAffected(...groups: (string[] | null)[]): string[] | null {
  if (groups.some(/* 检查是否有查询失败的一侧。 */ (group) => group === null)) return null;
  return [...new Set(groups.flat() as string[])];
}

/** 只失效受影响条目的详情页和聚合数据，并按路径刷新无标签的目录页；条目未知时退回全站失效。 */
export function revalidateMediaItems(ids: string[] | null) {
  if (ids === null) {
    revalidateAllMedia();
    return;
  }
  for (const id of ids) revalidateTag(mediaItemTag(id), { expire: 0 });
  revalidateTag(MEDIA_LISTS_TAG, { expire: 0 });
  for (const path of UNTAGGED_PUBLIC_PATHS) revalidatePath(path);
}

/** 使全部公开数据与页面失效；用于影响面无法界定的写入，例如人物改名或批量清理。 */
export function revalidateAllMedia() {
  revalidateTag(MEDIA_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
