"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "首页", href: "/", icon: "i-material-symbols-home-rounded" },
  { name: "电影", href: "/movies", icon: "i-material-symbols-movie-rounded" },
  { name: "电视", href: "/shows", icon: "i-material-symbols-tv-rounded" },
  { name: "音乐", href: "/albums", icon: "i-material-symbols-album-rounded" },
  { name: "图书", href: "/books", icon: "i-material-symbols-menu-book-rounded" },
  { name: "搜索", href: "/search", icon: "i-material-symbols-search-rounded" },
];

/** 768px 以下的底部悬浮玻璃标签栏，单手直达主要栏目；平板及以上隐藏，由顶部导航承担。 */
export default function MobileTabBar() {
  const pathname = usePathname();

  /** 首页要求路径完全匹配，其他栏目按路径前缀判断当前状态。 */
  const isActive = (href: string) => (href === "/" ? pathname === href : pathname.startsWith(href));

  return (
    <>
      {/* 渐变遮罩盖住标签栏上方一段内容，避免文字直接透出玻璃。 */}
      <div aria-hidden="true" className="mobile-tab-scrim md:hidden" />
      <nav
        aria-label="底部导航"
        className="mobile-tab-bar fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 grid h-16 grid-cols-6 gap-0.5 rounded-full p-1.5 sm:inset-x-4 sm:gap-1 md:hidden"
      >
        {TABS.map(
          /* 渲染一个底部栏目入口并标记当前栏目。 */ (tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors duration-200 ${
                  active
                    ? "bg-white/14 font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
                    : "text-fg-secondary hover:text-white"
                }`}
              >
                <span
                  className={`${tab.icon} size-5 ${active ? "text-[var(--accent-light)]" : ""}`}
                  aria-hidden="true"
                />
                {tab.name}
              </Link>
            );
          },
        )}
      </nav>
    </>
  );
}
