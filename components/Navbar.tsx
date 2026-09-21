"use client";

import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/api/search-limits";

import { useNavbarAuth } from "@/lib/auth/use-navbar-auth";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/** 渲染当前栏目导航、搜索表单和可折叠移动菜单，并处理搜索跳转。 */
export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const auth = useNavbarAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  /** 监听全局键盘快捷键（'/' 与 '⌘K / Ctrl+K'），快捷聚焦搜索框或跳转搜索页。 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;

      if (!isCmdK && !isSlash) return;

      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      if (isSlash && isEditable) return;

      e.preventDefault();

      if (window.innerWidth < 640 || !searchInputRef.current) {
        router.push("/search");
        return;
      }

      searchInputRef.current.focus();
      searchInputRef.current.select();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  /** 关闭移动端导航菜单。 */
  const closeMenu = () => setIsMobileMenuOpen(false);

  const navItems = [
    { name: "首页", href: "/" },
    { name: "电影", href: "/movies" },
    { name: "电视剧", href: "/series" },
    ...(auth.owner ? [{ name: "管理", href: "/manage" }] : []),
  ];

  /** 首页要求路径完全匹配，其他栏目按路径前缀判断当前状态。 */
  const isActive = (href: string) => {
    return (href === "/") ? pathname === href : pathname.startsWith(href);
  };

  /** 阻止表单默认提交，修剪搜索词并关闭菜单，再导航到带编码关键词的搜索页。 */
  const handleSearch = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const query = formData.get("q")?.toString().trim() || "";

    closeMenu();

    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    } else {
      router.push("/search");
    }
  };

  return (
    <nav aria-label="主要导航" className="fixed top-0 inset-x-0 z-50 pointer-events-none transition-all duration-300">
      <div aria-hidden="true" className="navbar-scroll-blur-mask" />
      <div className="container mx-auto max-w-7xl px-4 pt-2.5 sm:px-6 sm:pt-4 lg:px-8">
        <div className="surface-panel pointer-events-auto flex h-14 w-full items-center justify-between px-4 sm:px-6 rounded-2xl">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 group cursor-pointer"
            onClick={closeMenu}
          >
            <span className="i-material-symbols-terminal-rounded inline-block size-4 text-[var(--accent)] group-hover:rotate-12 transition-transform duration-300" aria-hidden="true" />
            <span className="font-mono text-xl font-light tracking-tight">
              <span className="bg-clip-text text-transparent bg-linear-to-br from-white via-white/90 to-white/60">
                bingetrack
              </span>
              <span className="text-[var(--accent)] font-black -mx-0.5">
                .
              </span>
              <span className="bg-clip-text text-transparent bg-linear-to-br from-white/90 to-white/50">
                ing
              </span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1.5 text-sm font-medium">
            {navItems.map(/* 为桌面导航生成栏目链接并标记当前栏目。 */ (item) => (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 transition-all duration-200 ${
                  isActive(item.href)
                    ? "surface-active text-[var(--accent)] font-semibold shadow-xs" 
                    : "text-white/65 hover:text-white hover:bg-white/5" 
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form
            onSubmit={handleSearch}
            className="relative group hidden sm:block"
          >
            <button
              type="submit"
              aria-label="搜索"
              className="absolute inset-y-0 left-0 flex items-center pl-3.5 cursor-pointer z-10"
            >
              <span className="i-material-symbols-search-rounded inline-block size-4 text-white/50 group-focus-within:text-white transition-colors duration-300" aria-hidden="true" />
            </button>
            <input
              ref={searchInputRef}
              name="q"
              type="text"
              placeholder="搜索"
              maxLength={MAX_SEARCH_QUERY_LENGTH}
              title={`搜索词最多 ${MAX_SEARCH_QUERY_LENGTH} 个字符`}
              className="surface-control text-white text-sm rounded-full
              block w-36 focus:w-56 sm:w-44 lg:focus:w-56 pl-10 pr-9 py-1.5 transition-all duration-500 ease-out
              placeholder-white/50 outline-none"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-white/40 group-focus-within:opacity-0 transition-opacity">
              ⌘K
            </kbd>
          </form>

          {/* 移动端独立搜索按钮：单手直达搜索页 */}
          <Link
            href="/search"
            aria-label="搜索影视"
            onClick={closeMenu}
            className="surface-control flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/80 outline-none transition-all duration-200 hover:border-white/40 hover:bg-white/10 hover:text-white active:scale-95 sm:hidden"
          >
            <span className="i-material-symbols-search-rounded inline-block size-4.5" aria-hidden="true" />
          </Link>

          {auth.signedIn ? (
            <form action="/auth/logout" method="POST" onSubmit={closeMenu}>
              <button type="submit" className="surface-control shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium text-white/90 transition-all duration-200 hover:border-white/40 hover:bg-white/10 hover:text-white active:scale-95">退出</button>
            </form>
          ) : (
            <button type="button" disabled={auth.busy} onClick={() => {
              closeMenu();
              void auth.signIn();
            }} className="surface-control shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium text-white/90 transition-all duration-200 hover:border-white/40 hover:bg-white/10 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-white/20 disabled:hover:bg-transparent disabled:hover:shadow-none disabled:active:scale-100">
              {auth.busy ? "验证中…" : "登录"}
            </button>
          )}

          <button
            className="surface-control flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/80 outline-none transition-all duration-200 hover:border-white/40 hover:bg-white/10 hover:text-white active:scale-95 lg:hidden"
            aria-label={isMobileMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={/* 切换移动端菜单的展开状态。 */ () => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <span className="i-material-symbols-close-rounded inline-block size-5" aria-hidden="true" /> : <span className="i-material-symbols-menu-rounded inline-block size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-navigation"
        aria-hidden={!isMobileMenuOpen}
        inert={!isMobileMenuOpen ? true : undefined}
        className={`surface-overlay pointer-events-auto w-full mt-2 overflow-hidden rounded-2xl transition-all duration-500 ease-in-out lg:hidden ${
          isMobileMenuOpen
            ? "max-h-[32rem] opacity-100 py-4"
            : "max-h-0 opacity-0 py-0 border-transparent pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-3 px-4 text-base font-medium sm:px-6">
          {navItems.map(/* 为移动菜单生成栏目链接并标记当前栏目。 */ (item) => (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 transition-all ${
                isActive(item.href)
                  ? "surface-active text-[var(--accent)] font-semibold"
                  : "text-white/65 hover:text-white hover:bg-white/5"
              }`}
              onClick={closeMenu}
            >
              {item.name}
            </Link>
          ))}

          <form
            onSubmit={handleSearch}
            className="relative mt-2 sm:hidden group"
          >
            <button
              type="submit"
              aria-label="搜索"
              className="absolute inset-y-0 left-0 flex items-center pl-3.5 cursor-pointer z-10"
            >
              <span className="i-material-symbols-search-rounded inline-block size-4 text-white/50 group-focus-within:text-white transition-colors duration-300" aria-hidden="true" />
            </button>

            <input
              name="q"
              type="text"
              placeholder="搜索"
              maxLength={MAX_SEARCH_QUERY_LENGTH}
              title={`搜索词最多 ${MAX_SEARCH_QUERY_LENGTH} 个字符`}
              className="surface-control text-white text-sm rounded-xl block w-full pl-10 pr-4 py-2.5 outline-none placeholder-white/50 transition-all duration-300"
            />
          </form>
        </div>
      </div>
      {auth.error && <p role="alert" className="pointer-events-auto mt-2 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 backdrop-blur-xl">{auth.error}</p>}
      </div>
    </nav>
  );
}
