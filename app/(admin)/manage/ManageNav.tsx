"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { useNavState } from "../AdminFrame";
import RefreshCacheButton from "./RefreshCacheButton";

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
const settings = { label: "账号安全", value: "settings", icon: "i-material-symbols-shield-person-rounded" };

/** 桌面整列侧栏和手机抽屉共用这一套入口。季与单集在电视节目工作台里编辑，归入「电视节目」。 */
export default function ManageNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { collapsed, toggle, drawerOpen, setDrawerOpen, isDesktop } = useNavState();
  const asideRef = useRef<HTMLElement>(null);
  const search = params.toString();
  const iconOnly = collapsed && isDesktop;
  const active = pathname.startsWith("/settings") ? "settings" : pathname.startsWith("/manage/reports") ? "reports" : pathname.startsWith("/manage/references/") ? pathname.split("/")[3] : params.get("type") ?? (pathname === "/manage" ? "home" : "");
  const highlighted = active === "tv_season" || active === "tv_episode" ? "tv_show" : active;

  useEffect(() => {
    const isList = (pathname === "/manage" && params.has("type")) || /^\/manage\/references\/[^/]+$/.test(pathname);
    if (!isList || !active) return;
    try { sessionStorage.setItem(`manage:list:${active}`, `${pathname}?${search}`); } catch { /* 隐私模式拒绝存储时仍可正常管理。 */ }
  }, [pathname, params, active, search]);

  // 换页后收起抽屉。首次挂载不关，避免和刚点开的抽屉打架。
  const route = `${pathname}?${search}`;
  const routeRef = useRef(route);
  useEffect(() => {
    if (routeRef.current === route) return;
    routeRef.current = route;
    setDrawerOpen(false);
  }, [route, setDrawerOpen]);

  // 手机抽屉打开时把焦点放进侧栏，Tab 在里面循环，Escape 关闭并回到菜单按钮。
  useEffect(() => {
    if (!drawerOpen || isDesktop) return;
    const aside = asideRef.current;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => [...(aside?.querySelectorAll<HTMLElement>("a, button") ?? [])].filter((element) => !element.hasAttribute("disabled"));
    items()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab" || !aside) return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previously?.focus();
    };
  }, [drawerOpen, isDesktop, setDrawerOpen]);

  /** 关联资料与报告使用独立路由，影视保留可分享的类型筛选。 */
  function href(value: string) {
    return value === "home" ? "/manage" : value === "settings" ? "/settings" : value === "reports" ? "/manage/reports" : value.startsWith("tv_") || value === "movie" ? `/manage?type=${value}` : `/manage/references/${value}`;
  }

  /** 切换分类进入该类别第一页。未保存确认已由 UnsavedGuard 在捕获阶段处理，取消时事件不会传到这里。 */
  function open(event: React.MouseEvent, value: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const targetHref = href(value);
    if (value !== "home") { try { sessionStorage.setItem(`manage:list:${value}`, targetHref); } catch { /* 记不住上次列表也不影响跳转。 */ } }
    setDrawerOpen(false);
    router.push(targetHref);
  }

  function itemClass(selected: boolean) {
    return `group relative flex items-center rounded-lg text-sm transition-colors ${iconOnly ? "size-11 justify-center" : "min-h-10 gap-3 px-3"} ${selected ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-light)]" : "text-fg-secondary hover:bg-white/5 hover:text-fg"}`;
  }

  function entry(item: { label: string; value: string; icon: string }) {
    const selected = highlighted === item.value;
    return (
      <Link
        key={item.value}
        href={href(item.value)}
        onClick={(event) => open(event, item.value)}
        aria-current={selected ? "page" : undefined}
        aria-label={iconOnly ? item.label : undefined}
        title={iconOnly ? item.label : undefined}
        className={itemClass(selected)}
      >
        {selected && !iconOnly ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[var(--accent)]" aria-hidden="true" /> : null}
        <span className={`${item.icon} size-4.5 inline-block shrink-0`} aria-hidden="true" />
        {!iconOnly && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  return (
    <aside
      ref={asideRef}
      id="admin-nav-drawer"
      aria-label="管理导航"
      role={drawerOpen && !isDesktop ? "dialog" : undefined}
      aria-modal={drawerOpen && !isDesktop ? true : undefined}
      className={`admin-sidebar ${drawerOpen ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""} flex-col border-r border-[var(--border)] bg-[var(--surface-panel)]`}
    >
      <div className={`flex shrink-0 items-center gap-2 border-b border-[var(--border)] ${iconOnly ? "justify-center px-2 py-3" : "px-4 py-4"}`}>
        <Link href="/manage" aria-label="bingetrack.ing" className={`flex min-w-0 items-center rounded-lg text-fg ${iconOnly ? "size-11 justify-center" : "gap-2"}`}>
          <BrandMark className="size-6 shrink-0" />
          {!iconOnly && <span className="truncate font-mono text-sm font-medium tracking-tight">bingetrack<span className="text-[var(--accent)]">.</span>ing</span>}
        </Link>
        {!iconOnly && <span className="ml-auto"><RefreshCacheButton iconOnly /></span>}
        {drawerOpen && (
          <button type="button" className="admin-nav-item is-icon admin-drawer-only" aria-label="关闭管理导航" onClick={() => setDrawerOpen(false)}>
            <span className="i-material-symbols-close-rounded size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label="内容管理分类" className={`flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain py-4 ${iconOnly ? "items-center px-2" : "px-3"}`}>
        {entry(home)}
        {groups.map((group) => (
          <div key={group.label} className={iconOnly ? "flex w-full flex-col items-center gap-1 border-t border-[var(--border)] pt-3" : ""}>
            {iconOnly ? null : <p className="mb-2 px-3 text-sm font-medium text-fg-subtle">{group.label}</p>}
            <div role="group" aria-label={group.label} className={`flex flex-col gap-1 ${iconOnly ? "items-center" : ""}`}>
              {group.items.map(entry)}
            </div>
          </div>
        ))}
      </nav>

      <div className={`flex shrink-0 flex-col gap-1 border-t border-[var(--border)] p-3 ${iconOnly ? "items-center" : ""}`}>
        {iconOnly && <RefreshCacheButton iconOnly />}
        {entry(settings)}
        <Link href="/" aria-label={iconOnly ? "查看公开网站" : undefined} title={iconOnly ? "查看公开网站" : undefined} className={itemClass(false)}>
          <span className="i-material-symbols-open-in-new-rounded size-4.5 shrink-0" aria-hidden="true" />
          {!iconOnly && <span className="truncate">查看公开网站</span>}
        </Link>
        <form action="/auth/logout" method="POST" className={iconOnly ? "" : "w-full"}>
          <button type="submit" className={`admin-nav-item ${iconOnly ? "is-icon" : ""}`} aria-label={iconOnly ? "退出" : undefined} title={iconOnly ? "退出" : undefined}>
            <span className="i-material-symbols-logout-rounded size-4.5 shrink-0" aria-hidden="true" />
            {!iconOnly && "退出"}
          </button>
        </form>
        <div className="hidden lg:flex">
          <button type="button" onClick={toggle} aria-label={collapsed ? "展开侧栏" : "收起侧栏"} title={collapsed ? "展开侧栏" : "收起侧栏"} aria-expanded={!collapsed} className="admin-nav-item is-icon">
            <span className={`${collapsed ? "i-material-symbols-left-panel-open-rounded" : "i-material-symbols-left-panel-close-rounded"} size-4.5`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
