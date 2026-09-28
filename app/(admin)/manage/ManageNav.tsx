"use client";
import { useEffect } from "react";
import { mayLeaveEditor } from "@/lib/admin/navigation";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RefreshCacheButton from "./RefreshCacheButton";

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
/** 桌面侧栏和移动分类选择共用相同入口，筛选结果可直接收藏。季与单集在电视节目工作台中编辑，归入「电视节目」。 */
export default function ManageNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const active = pathname.startsWith("/settings") ? "settings" : pathname.startsWith("/manage/reports") ? "reports" : pathname.startsWith("/manage/references/") ? pathname.split("/")[3] : params.get("type") ?? (pathname === "/manage" ? "movie" : "");
  const highlighted = active === "tv_season" || active === "tv_episode" ? "tv_show" : active;
  useEffect(() => {
    const isList = pathname === "/manage" || /^\/manage\/references\/[^/]+$/.test(pathname);
    if (!isList || !active) return;
    try { sessionStorage.setItem(`manage:list:${active}`, `${pathname}?${params.toString()}`); } catch { /* 隐私模式拒绝存储时仍可正常管理。 */ }
  }, [pathname, params, active]);
  /** 关联资料与报告使用独立路由，影视保留可分享的类型筛选。 */
  function href(value: string) { return value === "settings" ? "/settings" : value === "reports" ? "/manage/reports" : value.startsWith("tv_") || value === "movie" ? `/manage?type=${value}` : `/manage/references/${value}`; }
  return <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
    <div className="lg:hidden flex items-center justify-between gap-3">
      <label className="flex-1">管理类别<select value={highlighted} onChange={/* 切换分类时进入该类别第一页。 */ event => {
        if (mayLeaveEditor()) {
          const targetHref = href(event.target.value);
          try { sessionStorage.setItem(`manage:list:${event.target.value}`, targetHref); } catch {}
          router.push(targetHref);
        }
      }}>
        {!highlighted && <option value="" disabled>编辑内容</option>}
        {groups.map(/* 保持移动端与桌面的分组一致。 */ group => <optgroup key={group.label} label={group.label}>{group.items.map(/* 分类入口。 */ item => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}
        <optgroup label="账号"><option value="settings">账号安全</option></optgroup>
      </select></label>
      <div className="shrink-0 self-end mb-1">
        <RefreshCacheButton compact />
      </div>
    </div>
    {/* surface-panel 为普通样式类，不能加 lg: 前缀，故桌面侧栏单独包一层面板。 */}
    <div className="admin-side-panel surface-panel hidden flex-col rounded-2xl p-3 lg:flex">
    <div className="mb-4 px-3"><p className="mt-2 text-xl font-semibold text-white">内容工作台</p></div>
    <div className="mb-6">
      <RefreshCacheButton />
    </div>
    <nav aria-label="内容管理分类" className="mb-6 space-y-6">
      {groups.map(group => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-xs font-medium tracking-wider text-fg-subtle">{group.label}</p>
          <div className="space-y-1">
            {group.items.map(item => {
              const isSelected = highlighted === item.value;
              return (
                <Link
                  key={item.value}
                  href={href(item.value)}
                  onClick={event => {
                    // 未保存确认已由 UnsavedGuard 在捕获阶段处理，取消时事件不会传到这里；此处再确认会弹两次。
                    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    const targetHref = href(item.value);
                    try { sessionStorage.setItem(`manage:list:${item.value}`, targetHref); } catch {}
                    router.push(targetHref);
                  }}
                  aria-current={isSelected ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
                    isSelected
                      ? "border-[var(--accent-border)] bg-[var(--accent-soft)] font-medium text-[var(--accent-light)] shadow-[0_2px_12px_var(--accent-glow-soft)]"
                      : "border-transparent text-fg-secondary hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className={`${item.icon} size-4.5 inline-block shrink-0`} aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                  {isSelected && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
    <div className="mt-auto space-y-2 border-t border-white/10 pt-5 text-sm text-fg-muted">
      <Link href="/settings" aria-current={active === "settings" ? "page" : undefined} className={`flex items-center gap-3 rounded-xl p-3 transition-colors hover:text-white ${active === "settings" ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-light)]" : ""}`}><span className="i-material-symbols-settings-rounded size-4.5 inline-block shrink-0" aria-hidden="true" />账号安全</Link>
    </div>
    </div>
  </aside>;
}
