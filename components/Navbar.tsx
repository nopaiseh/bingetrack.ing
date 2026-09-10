"use client";

import { useNavbarAuth } from "@/lib/auth/use-navbar-auth";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, Terminal, X } from "lucide-react";

/** 渲染当前栏目导航、搜索表单和可折叠移动菜单，并处理搜索跳转。 */
export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const auth = useNavbarAuth();
  const pathname = usePathname();
  const router = useRouter();

  /** 关闭移动端导航菜单。 */
  const closeMenu = () => setIsMobileMenuOpen(false);

  const navItems = [
    { name: "首页", href: "/" },
    { name: "电影", href: "/movies" },
    { name: "电视剧", href: "/series" },
    ...(auth.owner ? [{ name: "管理", href: "/manage" }, { name: "设置", href: "/settings" }] : []),
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
    <nav aria-label="主要导航" className="surface-overlay fixed left-0 top-0 z-50 w-full border-x-0 border-t-0 transition-all duration-300">
      <div className="flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:mx-auto lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 group cursor-pointer"
            onClick={closeMenu}
          >
            <Terminal className="size-4 text-red-500 group-hover:rotate-12 group-hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-300" aria-hidden="true" />
            <span className="font-mono text-xl font-light tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]">
              <span className="bg-clip-text text-transparent bg-linear-to-br from-white via-white/80 to-white/50">
                bingetrack
              </span>
              <span className="text-red-500 font-black -mx-0.5 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                .
              </span>
              <span className="bg-clip-text text-transparent bg-linear-to-br from-white/90 to-white/40">
                ing
              </span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-5 text-sm font-medium">
            {navItems.map(/* 为桌面导航生成栏目链接并标记当前栏目。 */ (item) => (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`transition-all duration-300 ${
                  isActive(item.href)
                    ? "text-red-500 font-bold drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] scale-105" 
                    : "text-white/60 hover:text-red-400 hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]" 
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
              <Search className="size-4 text-white/50 group-focus-within:text-white group-focus-within:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300" aria-hidden="true" />
            </button>
            <input
              name="q"
              type="text"
              placeholder="搜索"
              className="surface-control text-white text-sm rounded-full
              focus:bg-white/10 focus:ring-1 focus:ring-white/30 focus:border-white/30
              block w-36 focus:w-52 sm:w-44 lg:focus:w-52 pl-10 py-2.5 transition-all duration-500 ease-out
              placeholder-white/40 outline-none
              shadow-[0_4px_15px_rgba(0,0,0,0.2)]
              focus:shadow-[0_4px_25px_rgba(255,255,255,0.05)]"
            />
          </form>

          {auth.signedIn ? (
            <form action="/auth/logout" onSubmit={closeMenu}>
              <button type="submit" className="surface-control shrink-0 rounded-full px-3 py-2.5 text-sm text-white/80 hover:text-white">退出</button>
            </form>
          ) : (
            <button type="button" disabled={auth.busy} onClick={() => {
              closeMenu();
              void auth.signIn();
            }} className="surface-control shrink-0 rounded-full px-3 py-2.5 text-sm text-white/80 hover:text-white disabled:opacity-60">
              {auth.busy ? "验证中…" : "登录"}
            </button>
          )}

          <button
            className="surface-control flex size-11 items-center justify-center rounded-full p-2 text-white/70 outline-none hover:text-white lg:hidden
            hover:bg-white/10 hover:border-white/20 hover:shadow-[0_6px_20px_rgba(255,255,255,0.05)] transition-all duration-300"
            aria-label={isMobileMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={/* 切换移动端菜单的展开状态。 */ () => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-navigation"
        aria-hidden={!isMobileMenuOpen}
        inert={!isMobileMenuOpen ? true : undefined}
        className={`surface-muted overflow-hidden border-b border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.2)] backdrop-blur-3xl transition-all duration-500 ease-in-out lg:hidden ${
          isMobileMenuOpen
            ? "max-h-[32rem] opacity-100 py-4"
            : "max-h-0 opacity-0 py-0 border-transparent"
        }`}
      >
        <div className="flex flex-col gap-4 px-4 text-base font-medium sm:px-6">
          {navItems.map(/* 为移动菜单生成栏目链接并标记当前栏目。 */ (item) => (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`block py-2 transition-all ${
                isActive(item.href)
                  ? "text-red-500 font-bold drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] translate-x-2"
                  : "text-white/60 hover:text-red-400 hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.6)] hover:translate-x-1"
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
              <Search className="size-4 text-white/50 group-focus-within:text-white group-focus-within:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300" aria-hidden="true" />
            </button>

            <input
              name="q"
              type="text"
              placeholder="搜索"
              className="surface-control text-white text-sm rounded-xl block w-full pl-10 py-2.5 outline-none
              focus:bg-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/30
              shadow-[0_4px_15px_rgba(0,0,0,0.2)]
              focus:shadow-[0_6px_25px_rgba(255,255,255,0.05)]
              placeholder-white/40 transition-all duration-300"
            />
          </form>
        </div>
      </div>
      {auth.error && <p role="alert" className="border-t border-white/10 px-4 py-3 text-sm text-red-300">{auth.error}</p>}
    </nav>
  );
}
