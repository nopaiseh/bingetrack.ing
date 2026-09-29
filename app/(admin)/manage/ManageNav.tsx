"use client";
import { useEffect, useRef } from "react";
import { mayLeaveEditor } from "@/lib/admin/navigation";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RefreshCacheButton from "./RefreshCacheButton";
import { useNavState } from "../AdminFrame";

const home = { label: "概览", value: "home", icon: "i-material-symbols-dashboard-rounded" };
const groups = [
  { label: "影视内容", items: [
    { label: "电影", value: "movie", icon: "i-material-symbols-movie-rounded" },
    { label: "电视节目", value: "tv_show", icon: "i-material-symbols-tv-rounded" },
  ] },
  { label: "关联资料", items: [
    { label: "人物", value: "people", icon: "i-material-symbols-group-rounded" },
    { label: "系列", value: "collections", icon: "i-material-symbols-collections-bookmark-rounded" },
    { label: "类型", value: "genres", icon: "i-material-symbols-sell-rounded" },
    { label: "地区", value: "regions", icon: "i-material-symbols-public-rounded" },
    { label: "语言", value: "languages", icon: "i-material-symbols-translate-rounded" },
  ] },
  { label: "数据检查", items: [
    { label: "报告", value: "reports", icon: "i-material-symbols-fact-check-outline-rounded" },
  ] },
];
const selectedStyle = "border-[var(--accent-border)] bg-[var(--accent-soft)] font-medium text-[var(--accent-light)] shadow-[0_2px_12px_var(--accent-glow-soft)]";
const idleStyle = "border-transparent text-fg-secondary hover:bg-white/5 hover:text-white";

/** 桌面侧栏和移动分类选择共用相同入口，筛选结果可直接收藏。季与单集在电视节目工作台中编辑，归入「电视节目」。
 * 桌面侧栏可收起成图标栏，名称改由提示与无障碍标签提供。 */
export default function ManageNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { collapsed, toggle } = useNavState();
  const panel = useRef<HTMLDivElement>(null);
  // 把导航的实际高度写入 CSS 变量，剧集结构栏据此与导航等高；收起、展开或字体变化时随之更新。
  useEffect(() => {
    const element = panel.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      const height = element.getBoundingClientRect().height;
      if (height > 0) root.style.setProperty("--admin-nav-height", `${height}px`);
    });
    observer.observe(element);
    return () => { observer.disconnect(); root.style.removeProperty("--admin-nav-height"); };
  }, [collapsed]);
  const active = pathname.startsWith("/settings") ? "settings" : pathname.startsWith("/manage/reports") ? "reports" : pathname.startsWith("/manage/references/") ? pathname.split("/")[3] : params.get("type") ?? (pathname === "/manage" ? "home" : "");
  const highlighted = active === "tv_season" || active === "tv_episode" ? "tv_show" : active;
  useEffect(() => {
    const isList = (pathname === "/manage" && params.has("type")) || /^\/manage\/references\/[^/]+$/.test(pathname);
    if (!isList || !active) return;
    try { sessionStorage.setItem(`manage:list:${active}`, `${pathname}?${params.toString()}`); } catch { /* 隐私模式拒绝存储时仍可正常管理。 */ }
  }, [pathname, params, active]);
  /** 关联资料与报告使用独立路由，影视保留可分享的类型筛选。 */
  function href(value: string) { return value === "home" ? "/manage" : value === "settings" ? "/settings" : value === "reports" ? "/manage/reports" : value.startsWith("tv_") || value === "movie" ? `/manage?type=${value}` : `/manage/references/${value}`; }
  /** 切换分类进入该类别第一页；未保存确认已由 UnsavedGuard 在捕获阶段处理，取消时事件不会传到这里，此处再确认会弹两次。 */
  function open(event: React.MouseEvent, value: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const targetHref = href(value);
    if (value !== "home") { try { sessionStorage.setItem(`manage:list:${value}`, targetHref); } catch {} }
    router.push(targetHref);
  }
  /** 展开时为图标加名称的导航项，收起时只留图标。 */
  function entry(item: { label: string; value: string; icon: string }) {
    const isSelected = highlighted === item.value;
    return <Link key={item.value} href={href(item.value)} onClick={event => open(event, item.value)} aria-current={isSelected ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined}
      className={collapsed
        ? `flex size-11 items-center justify-center rounded-xl border transition-all duration-200 ${isSelected ? selectedStyle : idleStyle}`
        : `group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${isSelected ? selectedStyle : idleStyle}`}>
      <span className={`${item.icon} size-4.5 inline-block shrink-0`} aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && isSelected && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]" aria-hidden="true" />}
    </Link>;
  }
  const settings = { label: "账号安全", value: "settings", icon: "i-material-symbols-shield-person-rounded" };
  const toggleButton = <button type="button" onClick={toggle} aria-label={collapsed ? "展开侧栏" : "收起侧栏"} title={collapsed ? "展开侧栏" : "收起侧栏"} aria-expanded={!collapsed} className="!min-h-0 !size-10 shrink-0 !p-0 !rounded-xl text-fg-secondary">
    <span className={`${collapsed ? "i-material-symbols-left-panel-open-rounded" : "i-material-symbols-left-panel-close-rounded"} size-4.5`} aria-hidden="true" />
  </button>;

  return <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
    <div className="lg:hidden flex items-center justify-between gap-3">
      <label className="flex-1">管理类别<select value={highlighted} onChange={/* 切换分类时进入该类别第一页。 */ event => {
        if (mayLeaveEditor()) {
          const value = event.target.value;
          const targetHref = href(value);
          if (value !== "home") { try { sessionStorage.setItem(`manage:list:${value}`, targetHref); } catch {} }
          router.push(targetHref);
        }
      }}>
        {!highlighted && <option value="" disabled>编辑内容</option>}
        <option value="home">{home.label}</option>
        {groups.map(/* 保持移动端与桌面的分组一致。 */ group => <optgroup key={group.label} label={group.label}>{group.items.map(/* 分类入口。 */ item => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}
        <optgroup label="账号"><option value="settings">账号安全</option></optgroup>
      </select></label>
      <div className="shrink-0 self-end mb-1">
        <RefreshCacheButton compact />
      </div>
    </div>
    {/* surface-panel 为普通样式类，不能加 lg: 前缀，故桌面侧栏单独包一层面板。 */}
    {collapsed ? <div ref={panel} className="admin-side-panel surface-panel hidden flex-col items-center gap-1.5 rounded-2xl px-2.5 py-3 lg:flex">
      <RefreshCacheButton iconOnly />
      <nav aria-label="内容管理分类" className="mt-2 flex flex-col items-center gap-1 border-t border-white/10 pt-3">
        {entry(home)}
        {groups.map(group => <div key={group.label} role="group" aria-label={group.label} className="flex flex-col items-center gap-1 border-t border-white/10 pt-3 mt-2">{group.items.map(entry)}</div>)}
      </nav>
      <div className="mt-2 flex flex-col items-center gap-1.5 border-t border-white/10 pt-3">{entry(settings)}{toggleButton}</div>
    </div> : <div ref={panel} className="admin-side-panel surface-panel hidden flex-col rounded-2xl p-3 lg:flex">
      <div className="mb-5 flex items-center justify-between gap-2 pl-3"><p className="text-xl font-semibold text-white">内容工作台</p><RefreshCacheButton iconOnly /></div>
      <nav aria-label="内容管理分类" className="mb-6 space-y-6">
        {entry(home)}
        {groups.map(group => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-xs font-medium tracking-wider text-fg-subtle">{group.label}</p>
            <div className="space-y-1">{group.items.map(entry)}</div>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-1 border-t border-white/10 pt-4"><div className="min-w-0 flex-1">{entry(settings)}</div>{toggleButton}</div>
    </div>}
  </aside>;
}
