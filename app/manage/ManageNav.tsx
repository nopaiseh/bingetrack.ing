"use client";
import { useEffect } from "react";
import { rememberedList, mayLeaveEditor } from "@/lib/admin/navigation";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RefreshCacheButton from "./RefreshCacheButton";

const groups = [
  { label: "影视内容", items: [
    { label: "电影", value: "movie", icon: "i-material-symbols-movie-rounded", isChild: false },
    { label: "电视剧", value: "tv_series", icon: "i-material-symbols-tv-rounded", isChild: false },
    { label: "剧季", value: "tv_season", icon: "i-material-symbols-layers-rounded", isChild: true },
    { label: "剧集", value: "tv_episode", icon: "i-material-symbols-video-library-rounded", isChild: true },
  ] },
  { label: "关联资料", items: [
    { label: "人物", value: "people", icon: "i-material-symbols-group-rounded", isChild: false },
    { label: "系列", value: "collections", icon: "i-material-symbols-collections-bookmark-rounded", isChild: false },
    { label: "题材流派", value: "genres", icon: "i-material-symbols-sell-rounded", isChild: false },
    { label: "地区", value: "regions", icon: "i-material-symbols-public-rounded", isChild: false },
    { label: "语言", value: "languages", icon: "i-material-symbols-translate-rounded", isChild: false },
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
    <div className="mb-4 hidden px-3 lg:block"><p className="mt-2 text-xl font-semibold text-white">内容工作台</p></div>
    <div className="mb-6 hidden lg:block">
      <RefreshCacheButton />
    </div>
    <div className="lg:hidden flex items-center justify-between gap-3">
      <label className="flex-1">管理类别<select value={active} onChange={/* 切换分类时进入该类别第一页。 */ event => { if (mayLeaveEditor()) router.push(rememberedList(event.target.value, href(event.target.value))); }}>
        {!active && <option value="" disabled>编辑内容</option>}
        {groups.map(/* 保持移动端与桌面的分组一致。 */ group => <optgroup key={group.label} label={group.label}>{group.items.map(/* 分类入口。 */ item => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}
      </select></label>
      <div className="shrink-0 self-end mb-1">
        <RefreshCacheButton compact />
      </div>
    </div>
    <nav aria-label="内容管理分类" className="hidden space-y-6 lg:block">
      {groups.map(group => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-xs font-medium tracking-wider text-white/40">{group.label}</p>
          <div className="space-y-1">
            {group.items.map(item => {
              const isSelected = active === item.value;
              return (
                <Link
                  key={item.value}
                  href={href(item.value)}
                  onClick={event => {
                    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    router.push(rememberedList(item.value, href(item.value)));
                  }}
                  aria-current={isSelected ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl border px-3 transition-all duration-200 ${
                    item.isChild ? "ml-4 py-2 text-xs" : "py-2.5 text-sm"
                  } ${
                    isSelected
                      ? "border-[var(--accent-border)] bg-[var(--accent-soft)] font-medium text-[var(--accent-light)] shadow-[0_2px_12px_var(--accent-glow-soft)]"
                      : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.isChild && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors shrink-0 ${
                        isSelected ? "bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]" : "bg-white/20 group-hover:bg-white/40"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span className={`${item.icon} ${item.isChild ? "size-4" : "size-4.5"} inline-block shrink-0`} aria-hidden="true" />
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
    <div className="mt-6 hidden space-y-2 border-t border-white/10 pt-5 text-sm text-white/60 lg:block">
      <Link href="/settings" className="flex items-center gap-3 p-3 transition-colors hover:text-white"><span className="i-material-symbols-settings-rounded size-4.5 inline-block shrink-0" aria-hidden="true" />账号安全</Link>
    </div>
  </aside>;
}
