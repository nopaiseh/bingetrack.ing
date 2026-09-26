"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "首页", href: "/", icon: "i-material-symbols-home-rounded" },
  { name: "电影", href: "/movies", icon: "i-material-symbols-movie-rounded" },
  { name: "电视剧", href: "/series", icon: "i-material-symbols-tv-rounded" },
  { name: "搜索", href: "/search", icon: "i-material-symbols-search-rounded" },
];

/** 768px 以下的底部悬浮玻璃标签栏，单手直达主要栏目；平板及以上隐藏，由顶部导航承担。 */
export default function MobileTabBar() {
  const pathname = usePathname();

  /** 首页要求路径完全匹配，其他栏目按路径前缀判断当前状态。 */
  const isActive = (href: string) => (href === "/" ? pathname === href : pathname.startsWith(href));

  return (
    <nav
      aria-label="底部导航"
      className="surface-panel fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 grid h-16 grid-cols-4 gap-1 rounded-full p-1.5 md:hidden"
    >
      {TABS.map(/* 渲染一个底部栏目入口并标记当前栏目。 */ (tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors duration-200 ${
              active
                ? "bg-white/14 font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
                : "text-white/75 hover:text-white"
            }`}
          >
            <span className={`${tab.icon} size-5 ${active ? "text-[var(--accent-light)]" : ""}`} aria-hidden="true" />
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
