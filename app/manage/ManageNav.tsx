"use client";
import { useEffect } from "react";
import { rememberedList, mayLeaveEditor } from "@/lib/admin/navigation";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const groups = [
  { label: "影视内容", items: [
    { label: "电影", value: "movie", icon: "i-material-symbols-movie-rounded" }, { label: "电视剧", value: "tv_series", icon: "i-material-symbols-tv-rounded" },
    { label: "剧季", value: "tv_season", icon: "i-material-symbols-layers-rounded" }, { label: "剧集", value: "tv_episode", icon: "i-material-symbols-video-library-rounded" },
  ] },
  { label: "关联资料", items: [
    { label: "人物", value: "people", icon: "i-material-symbols-group-rounded" }, { label: "系列", value: "collections", icon: "i-material-symbols-collections-bookmark-rounded" },
    { label: "类型", value: "genres", icon: "i-material-symbols-sell-rounded" }, { label: "地区", value: "regions", icon: "i-material-symbols-public-rounded" },
  ] },
];
/** 桌面侧栏和移动分类选择共用相同入口，筛选结果可直接收藏。 */
export default function ManageNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const active = pathname.startsWith("/manage/references/") ? pathname.split("/")[3] : params.get("type") ?? (pathname === "/manage" ? "movie" : "");
  useEffect(() => {
    const isList = pathname === "/manage" || /^\/manage\/references\/[^/]+$/.test(pathname);
    if (!isList || !active) return;
    try { sessionStorage.setItem(`manage:list:${active}`, `${pathname}?${params.toString()}`); } catch { /* 隐私模式拒绝存储时仍可正常管理。 */ }
  }, [pathname, params, active]);
  /** 关联资料使用独立路由，影视保留可分享的类型筛选。 */
  function href(value: string) { return value.startsWith("tv_") || value === "movie" ? `/manage?type=${value}` : `/manage/references/${value}`; }
  return <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
    <div className="mb-6 hidden px-3 lg:block"><p className="text-xs tracking-[.2em] text-red-300">BINGETRACKING</p><p className="mt-2 text-xl font-semibold text-white">内容工作台</p></div>
    <div className="lg:hidden"><label>管理类别<select value={active} onChange={/* 切换分类时进入该类别第一页。 */ event => { if (mayLeaveEditor()) router.push(rememberedList(event.target.value, href(event.target.value))); }}>
      {!active && <option value="" disabled>编辑内容</option>}
      {groups.map(/* 保持移动端与桌面的分组一致。 */ group => <optgroup key={group.label} label={group.label}>{group.items.map(/* 分类入口。 */ item => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}
    </select></label></div>
    <nav aria-label="内容管理分类" className="hidden space-y-6 lg:block">{groups.map(/* 两组分类共八个入口。 */ group => <div key={group.label}><p className="mb-2 px-3 text-xs text-neutral-400">{group.label}</p><div className="space-y-1">{group.items.map(/* 图标辅助辨认，选中态不只依赖颜色。 */ item => <Link key={item.value} href={href(item.value)} onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); router.push(rememberedList(item.value, href(item.value))); }} aria-current={active === item.value ? "page" : undefined} className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors ${active === item.value ? "border-red-400/25 bg-red-500/10 font-semibold text-red-200" : "border-transparent text-neutral-300 hover:bg-white/5"}`}><span className={`${item.icon} size-4.5 inline-block shrink-0`} aria-hidden="true" />{item.label}</Link>)}</div></div>)}</nav>
    <div className="mt-6 hidden space-y-2 border-t border-white/10 pt-5 text-sm text-neutral-400 lg:block"><Link href="/settings" className="flex items-center gap-3 p-3"><span className="i-material-symbols-settings-rounded size-4.5 inline-block shrink-0" aria-hidden="true" />账号安全</Link><Link href="/" className="flex items-center gap-3 p-3"><span className="i-material-symbols-arrow-outward-rounded size-4.5 inline-block shrink-0" aria-hidden="true" />浏览网站</Link></div>
  </aside>;
}
