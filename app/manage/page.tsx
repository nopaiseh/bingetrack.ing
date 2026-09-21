import Image from "next/image";
import Link from "next/link";
import { requireOwner } from "@/lib/auth/server";
import { mediaTypes, type ManagedMediaType } from "@/lib/admin/media-form";
import { isMediaId } from "@/lib/functions/media-id";
import StatusModal from "./StatusModal";

/** 分页搜索全部影视，或查看指定剧集／季的下属条目。 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db } = await requireOwner();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 200);
  const type = params.type && Object.hasOwn(mediaTypes, params.type) ? params.type as ManagedMediaType : "movie";
  const parent = isMediaId(params.parent) ? params.parent : "";
  const page = Math.min(100000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const relation = parent && (type === "tv_season" || type === "tv_episode");
  const fields = `id,title,type,cover_url,release_date,tracking(status,rating),tv_seasons!tv_seasons_id_fkey${parent && type === "tv_season" ? "!inner" : ""}(series_id,season_number,parent:media_items!tv_seasons_series_id_fkey(title),episodes:tv_episodes!tv_episodes_season_id_fkey(count)),tv_episodes!tv_episodes_id_fkey${parent && type === "tv_episode" ? "!inner" : ""}(season_id,episode_number,parent:tv_seasons!tv_episodes_season_id_fkey(media_items!tv_seasons_id_fkey(title),series:media_items!tv_seasons_series_id_fkey(title))),seasons:tv_seasons!tv_seasons_series_id_fkey(count)`;
  let query = db.from("media_items").select(fields, { count: "exact" }).eq("type", type);
  if (q) query = query.ilike("title", `%${q}%`);
  if (relation) query = query.eq(type === "tv_season" ? "tv_seasons.series_id" : "tv_episodes.season_id", parent);
  if (relation) query = query.order(type === "tv_season" ? "tv_seasons(season_number)" : "tv_episodes(episode_number)");
  const { data, count, error } = await query.order("title").order("id").range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("无法读取管理列表，请稍后重试。");
  const rows = data as unknown as { id: string; title: string; type: ManagedMediaType; cover_url: string | null; release_date: string | null; tv_seasons: { season_number: number; episodes?: { count: number }[]; parent?: { title: string } | null } | null; tv_episodes: { episode_number: number; parent?: { media_items?: { title: string } | null; series?: { title: string } | null } | null } | null; seasons?: { count: number }[]; tracking: { status: string; rating: number | null } | { status: string; rating: number | null }[] | null }[];
  const seriesStatusMap = new Map<string, { status: string; rating: number | null }>();
  const seasonStatusMap = new Map<string, { status: string }>();

  if (rows.length > 0) {
    const ids = rows.map(r => r.id);
    if (type === "tv_series") {
      const { data: statusList } = await db
        .from("v_all_media")
        .select("id, status, rating")
        .in("id", ids);
      if (statusList) {
        for (const item of statusList) {
          seriesStatusMap.set(item.id, {
            status: item.status ?? "want_to_watch",
            rating: item.rating != null ? Number(item.rating) : null,
          });
        }
      }
    } else if (type === "tv_season") {
      const { data: summaryList } = await db
        .from("v_media_season_summaries")
        .select("id, episode_count, watched_episode_count")
        .in("id", ids);
      if (summaryList) {
        for (const item of summaryList) {
          const episodeCount = Number(item.episode_count ?? 0);
          const watchedCount = Number(item.watched_episode_count ?? 0);
          const status = episodeCount > 0 && watchedCount === episodeCount
            ? "watched"
            : watchedCount > 0
              ? "watching"
              : "want_to_watch";
          seasonStatusMap.set(item.id, { status });
        }
      }
    }
  }

  /** 保留当前筛选条件生成分页地址。 */
  function pageUrl(next: number) {
    return `/manage?${new URLSearchParams({ q, type, parent, page: String(next) })}`;
  }
  return <section>
    <div className="surface-panel mb-8 rounded-3xl p-5 sm:p-8 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="admin-heading">{mediaTypes[type]}</h1><p className="mt-2 text-neutral-400">共 {count ?? 0} 个条目 · 管理影视与观看记录</p></div>
      <Link href={`/manage/media/new${type ? `?type=${type}${parent ? `&parent=${parent}` : ""}` : ""}`} className="admin-button admin-primary shrink-0">新增{type ? mediaTypes[type] : "媒体"}</Link>
    </div>
    {params.deleted === "1" && <StatusModal message="条目及其下属资料已删除。" />}
    {parent && (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-neutral-200">
          <span className="i-material-symbols-filter-alt-rounded size-4.5 text-[var(--accent)] shrink-0" aria-hidden="true" />
          <span>当前仅显示所选条目的下属{mediaTypes[type]}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/manage/media/${parent}`} className="text-xs text-neutral-300 underline hover:text-white transition-colors">
            返回上级条目
          </Link>
          <Link href={`/manage?type=${type}`} className="admin-button !py-1 !px-3 text-xs">
            查看全部{mediaTypes[type]}
          </Link>
        </div>
      </div>
    )}
    <form className="surface-panel mb-6 rounded-2xl p-4 sm:p-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
      <label>搜索标题<input name="q" defaultValue={q} maxLength={200} placeholder="输入电影、剧集或单集名称" /></label>
      <input type="hidden" name="type" value={type} />
      {parent && <input type="hidden" name="parent" value={parent} />}
      <button type="submit">筛选</button>
    </form>
    {rows.length > 0 && <ul className="surface-panel divide-y divide-white/10 overflow-hidden rounded-2xl">{rows.map(/* 兼容 PostgREST 根据唯一外键返回的单对象关系。 */ item => {
      const tracking = Array.isArray(item.tracking) ? item.tracking[0] : item.tracking;
      let status = tracking?.status ?? "want_to_watch";
      let rating = tracking?.rating != null ? Number(tracking.rating) : null;
      if (item.type === "tv_series") {
        const derived = seriesStatusMap.get(item.id);
        status = derived?.status ?? "want_to_watch";
        rating = derived?.rating ?? null;
      } else if (item.type === "tv_season") {
        const derived = seasonStatusMap.get(item.id);
        status = derived?.status ?? "want_to_watch";
        rating = null;
      }
      const statusLabel = status === "watched" ? "看过" : status === "watching" ? "在看" : "没看过";
      return <li key={item.id}>
      <Link href={`/manage/media/${item.id}?type=${item.type}`} className="group flex flex-col gap-3 p-5 transition-colors hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-4">{item.cover_url && <Image src={item.cover_url} alt="" width={44} height={66} className="h-16 w-11 shrink-0 rounded-md object-cover" />}<div className="min-w-0"><h2 className="break-words font-medium text-white transition-colors group-hover:text-[var(--accent-hover)]">{item.title}</h2><p className="mt-1 text-sm text-neutral-400">{mediaTypes[item.type]}{item.release_date ? ` · ${item.release_date}` : ""}</p><p className="mt-1 text-xs text-neutral-400">{item.tv_seasons ? `${item.tv_seasons.parent?.title ?? "未知剧集"} · 第 ${item.tv_seasons.season_number} 季` : item.tv_episodes ? `${item.tv_episodes.parent?.series?.title ?? ""} · ${item.tv_episodes.parent?.media_items?.title ?? "未知季"} · 第 ${item.tv_episodes.episode_number} 集` : ""}{item.type === "tv_series" ? `${item.seasons?.[0]?.count ?? 0} 季` : item.type === "tv_season" ? ` · ${item.tv_seasons?.episodes?.[0]?.count ?? 0} 集` : ""}</p></div></div>
        <span className="surface-muted w-fit shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">{statusLabel}{rating != null ? ` · ${rating} 分` : ""}</span>
      </Link>
    </li>; })}</ul>}
    {!rows.length && <p className="surface-panel rounded-2xl px-6 py-16 text-center text-neutral-400">没有符合条件的条目。</p>}
    <nav aria-label="管理列表分页" className="mt-6 flex items-center justify-between">
      {page > 1 ? <Link href={pageUrl(page - 1)} className="admin-button">上一页</Link> : <span />}
      <span className="text-sm text-neutral-400">第 {page} 页</span>
      {page * 25 < (count ?? 0) ? <Link href={pageUrl(page + 1)} className="admin-button">下一页</Link> : <span />}
    </nav>
  </section>;
}
