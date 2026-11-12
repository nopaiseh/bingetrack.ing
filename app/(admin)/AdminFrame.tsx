"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { NAV_COOKIE } from "@/lib/admin/navigation";
import RefreshCacheButton from "./manage/RefreshCacheButton";

const NavState = createContext<{
  collapsed: boolean;
  toggle: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** 1024px 及以上为桌面侧栏；手机抽屉始终展开文字，不跟收起偏好走。 */
  isDesktop: boolean;
}>({ collapsed: false, toggle: () => {}, drawerOpen: false, setDrawerOpen: () => {}, isDesktop: true });

/** 侧栏是否收起、手机抽屉是否打开。 */
export function useNavState() {
  return useContext(NavState);
}

/** 手机顶栏：菜单按钮打开同一套侧栏。桌面侧栏常驻，这条栏不显示。 */
function AdminMobileBar({ drawerOpen, setDrawerOpen }: { drawerOpen: boolean; setDrawerOpen: (open: boolean) => void }) {
  return (
    <div className="admin-mobile-bar sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--border)] bg-[var(--canvas)] px-3">
      <button
        type="button"
        className="admin-nav-item is-icon"
        aria-label="打开管理导航"
        aria-expanded={drawerOpen}
        aria-controls="admin-nav-drawer"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        <span className={`${drawerOpen ? "i-material-symbols-close-rounded" : "i-material-symbols-menu-rounded"} size-5`} aria-hidden="true" />
      </button>
      <Link href="/manage" className="min-w-0 truncate font-mono text-sm font-medium tracking-tight text-fg">
        bingetrack<span className="text-[var(--accent)]">.</span>ing
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <RefreshCacheButton iconOnly />
        <form action="/auth/logout" method="POST">
          <button type="submit" className="admin-nav-item !w-auto px-3">退出</button>
        </form>
      </div>
    </div>
  );
}

/** 管理区外框：桌面侧栏贴左整列，手机收到顶栏菜单里。偏好存入 Cookie，服务端首次渲染即用对应宽度。 */
export default function AdminFrame({ initialCollapsed, nav, children }: { initialCollapsed: boolean; nav: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${NAV_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!drawerOpen || isDesktop) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [drawerOpen, isDesktop]);

  return (
    <NavState value={{ collapsed, toggle, drawerOpen, setDrawerOpen, isDesktop }}>
      <div className="admin-frame flex min-h-dvh w-full items-start">
        {drawerOpen ? <button type="button" className="admin-backdrop" aria-label="关闭管理导航" onClick={() => setDrawerOpen(false)} /> : null}
        {nav}
        <div className="flex min-w-0 flex-1 flex-col" inert={drawerOpen && !isDesktop ? true : undefined}>
          <AdminMobileBar drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />
          <div className="admin-content w-full min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</div>
        </div>
      </div>
    </NavState>
  );
}
