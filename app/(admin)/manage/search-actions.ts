"use server";
import { requireOwner } from "@/lib/auth/server";
import { titleOrAliasFilter } from "@/lib/admin/catalog";
import type { ManagedMediaType } from "@/lib/admin/media-form";

export type MediaHit = { id: string; type: ManagedMediaType; title: string; context: string; coverUrl: string | null };

const LIMIT = 40;
const typeOrder: Record<ManagedMediaType, number> = { tv_show: 0, movie: 1, tv_season: 2, tv_episode: 3 };

type Row = {
  id: string; type: ManagedMediaType; title: string; alternate_title: string | null; release_date: string | null; cover_url: string | null;
  season: { season_number: number; parent: { title: string } | null } | null;
  episode: { episode_number: number; season: { season_number: number; series: { title: string } | null } | null } | null;
  seasons: { count: number }[] | null;
};

/** 季与单集附上所属节目和编号，同名条目也能分辨。 */
function context(row: Row) {
  const count = (value: number) => value.toLocaleString("en-US");
  if (row.type === "tv_episode") {
    const season = row.episode?.season;
    return [season?.series?.title ?? "未知电视节目", season && `第 ${count(season.season_number)} 季`, row.episode && `第 ${count(row.episode.episode_number)} 集`, row.release_date].filter(Boolean).join(" · ");
  }
  if (row.type === "tv_season") return [row.season?.parent?.title ?? "未知电视节目", row.season && `第 ${count(row.season.season_number)} 季`].filter(Boolean).join(" · ");
  if (row.type === "tv_show") return [row.alternate_title, `${count(row.seasons?.[0]?.count ?? 0)} 季`].filter(Boolean).join(" · ");
  return [row.alternate_title, row.release_date].filter(Boolean).join(" · ");
}

/** 一次搜索全部影视的标题与副标题；标题完全相同的排在最前，其次按节目、电影、季、单集。每次调用独立验证站长身份。 */
export async function searchMedia(term: string): Promise<{ hits: MediaHit[]; error?: string }> {
  const { db } = await requireOwner();
  const search = term.trim().slice(0, 200);
  if (!search) return { hits: [] };
  const { data, error } = await db.from("media_items")
    .select("id,type,title,alternate_title,release_date,cover_url,season:tv_seasons!tv_seasons_id_fkey(season_number,parent:media_items!tv_seasons_series_id_fkey(title)),episode:tv_episodes!tv_episodes_id_fkey(episode_number,season:tv_seasons!tv_episodes_season_id_fkey(season_number,series:media_items!tv_seasons_series_id_fkey(title))),seasons:tv_seasons!tv_seasons_series_id_fkey(count)")
    .in("type", ["movie", "tv_show", "tv_season", "tv_episode"])
    .or(titleOrAliasFilter(search))
    .order("title").order("id").limit(LIMIT);
  if (error) return { hits: [], error: "搜索失败，请重试。" };
  const exact = (row: Row) => (row.title === search || row.alternate_title === search ? 0 : 1);
  const rows = [...(data as unknown as Row[])].sort((a, b) => exact(a) - exact(b) || typeOrder[a.type] - typeOrder[b.type] || a.title.localeCompare(b.title, "zh-Hans-CN"));
  return { hits: rows.map(row => ({ id: row.id, type: row.type, title: row.title, context: context(row), coverUrl: row.cover_url })) };
}
