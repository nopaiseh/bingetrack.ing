import Link from "next/link";
import { requireOwner } from "@/lib/auth/server";
import { mediaTypes, type ManagedMediaType } from "@/lib/admin/media-form";
import { isMediaId } from "@/lib/functions/media-id";

/** 分页搜索全部影视，或查看指定剧集／季的下属条目。 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db } = await requireOwner();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 200);
  const type = params.type && Object.hasOwn(mediaTypes, params.type) ? params.type as ManagedMediaType : "";
  const parent = isMediaId(params.parent) ? params.parent : "";
  const page = Math.min(100000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const relation = parent && type === "tv_season" ? ",tv_seasons!tv_seasons_id_fkey!inner(series_id,season_number)" : parent && type === "tv_episode" ? ",tv_episodes!tv_episodes_id_fkey!inner(season_id,episode_number)" : "";
  let query = db.from("media_items").select(`id,title,type,release_date,tracking(status,rating)${relation}`, { count: "exact" }).in("type", Object.keys(mediaTypes));
  if (q) query = query.ilike("title", `%${q}%`);
  if (type) query = query.eq("type", type);
  if (relation) query = query.eq(type === "tv_season" ? "tv_seasons.series_id" : "tv_episodes.season_id", parent);
  if (relation) query = query.order(type === "tv_season" ? "tv_seasons(season_number)" : "tv_episodes(episode_number)");
  const { data, count, error } = await query.order("title").order("id").range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("无法读取管理列表，请稍后重试。");
  const rows = data as unknown as { id: string; title: string; type: ManagedMediaType; release_date: string | null; tracking: { status: string; rating: number | null } | { status: string; rating: number | null }[] | null }[];
  /** 保留当前筛选条件生成分页地址。 */
  function pageUrl(next: number) {
    return `/admin?${new URLSearchParams({ q, type, parent, page: String(next) })}`;
  }
  return <section>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-semibold text-white">媒体管理</h1><p className="mt-2 text-neutral-400">共 {count ?? 0} 个条目 · 公开浏览，站长编辑</p></div>
      <Link href={`/admin/media/new${parent && type ? `?type=${type}&parent=${parent}` : ""}`} className="admin-button admin-primary">新增{type ? mediaTypes[type] : "媒体"}</Link>
    </div>
    {params.deleted === "1" && <p role="status" className="mb-5 text-green-300">条目及其下属资料已删除。</p>}
    {parent && <p className="mb-5"><Link href={`/admin/media/${parent}`} className="underline">返回上级条目</Link></p>}
    <form className="mb-6 grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]">
      <label>搜索标题<input name="q" defaultValue={q} maxLength={200} placeholder="输入电影、剧集或单集名称" /></label>
      <label>媒体类型<select name="type" defaultValue={type}><option value="">全部类型</option>{Object.entries(mediaTypes).map(/* 显示支持的媒体类型。 */ ([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {parent && <input type="hidden" name="parent" value={parent} />}
      <button type="submit">筛选</button>
    </form>
    <ul className="divide-y divide-white/10 rounded-xl border border-white/15">{rows.map(/* 兼容 PostgREST 根据唯一外键返回的单对象关系。 */ item => {
      const tracking = Array.isArray(item.tracking) ? item.tracking[0] : item.tracking;
      return <li key={item.id}>
      <Link href={`/admin/media/${item.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-white/5">
        <div className="min-w-0"><h2 className="break-words font-medium text-white">{item.title}</h2><p className="mt-1 text-sm text-neutral-400">{mediaTypes[item.type]}{item.release_date ? ` · ${item.release_date}` : ""}</p></div>
        <span className="shrink-0 text-sm text-neutral-300">{tracking?.status === "watched" ? "看过" : "没看过"}{tracking?.rating != null ? ` · ${tracking.rating} 分` : ""}</span>
      </Link>
    </li>; })}</ul>
    {!rows.length && <p className="py-10 text-center text-neutral-400">没有符合条件的条目。</p>}
    <nav aria-label="管理列表分页" className="mt-6 flex items-center justify-between">
      {page > 1 ? <Link href={pageUrl(page - 1)} className="admin-button">上一页</Link> : <span />}
      <span className="text-sm text-neutral-400">第 {page} 页</span>
      {page * 25 < (count ?? 0) ? <Link href={pageUrl(page + 1)} className="admin-button">下一页</Link> : <span />}
    </nav>
  </section>;
}
