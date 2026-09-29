"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { NAV_COOKIE } from "@/lib/admin/navigation";

const NavState = createContext<{ collapsed: boolean; toggle: () => void }>({ collapsed: false, toggle: () => {} });

/** 侧栏是否收起；桌面侧栏据此切换完整导航与图标栏。 */
export function useNavState() {
  return useContext(NavState);
}

/** 管理区外框：左侧导航可收起成图标栏，偏好存入 Cookie，服务端首次渲染即用对应宽度，不会闪动。 */
export default function AdminFrame({ initialCollapsed, nav, children }: { initialCollapsed: boolean; nav: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${NAV_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }
  return <NavState value={{ collapsed, toggle }}>
    <div className={`grid gap-8 ${collapsed ? "lg:grid-cols-[4rem_minmax(0,1fr)]" : "lg:grid-cols-[12rem_minmax(0,1fr)]"}`}>{nav}<div className="min-w-0">{children}</div></div>
  </NavState>;
}
