"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; // <-- 新增 useRouter

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter(); // <-- 初始化 router

  const closeMenu = () => setIsMobileMenuOpen(false);

  const navItems = [
    { name: "首页", href: "/" },
    { name: "电影", href: "/movies" },
    { name: "电视剧", href: "/series" },
  ];

  const isActive = (href: string) => {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  };

  // 处理搜索提交
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault(); // 阻止表单默认的刷新提交
  
  // 获取表单里 name="q" 的 input 的值
  const formData = new FormData(e.currentTarget);
  const query = formData.get("q")?.toString().trim() || "";

  // 核心逻辑：有字就带参数搜，没字就直接去片库浏览
  if (query) {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  } else {
    router.push('/search'); 
  }
};

  return (
    <nav className="fixed w-full z-50 top-0 left-0 bg-[#0a0a0a]/40 backdrop-blur-md border-b border-white/5 transition-all duration-300">
      <div className="flex items-center justify-between w-full mx-auto px-6 md:px-8 h-16 max-w-7xl">
        <div className="flex items-center gap-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 group cursor-pointer"
            onClick={closeMenu}
          >
            <i className="fas fa-terminal text-red-500 text-base group-hover:rotate-12 transition-transform duration-300"></i>
            <span className="font-mono text-xl text-white font-light tracking-tight">
              <span className="text-white">bingewatch</span>
              <span className="text-red-500 font-black -mx-0.5">.</span>ing
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`transition-colors duration-300 ${
                  isActive(item.href)
                    ? "text-white font-bold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* 桌面端搜索框：加上 onSubmit */}
          <form
            onSubmit={handleSearch}
            className="relative group hidden sm:block"
          >
            <button
              type="submit"
              className="absolute inset-y-0 left-0 flex items-center pl-3.5 cursor-pointer z-10"
            >
              <i className="fas fa-search text-neutral-500 group-focus-within:text-neutral-300 transition-colors"></i>
            </button>
            <input
              name="q"
              type="text"
              placeholder="搜索"
              className="bg-white/5 border border-white/10 text-white text-sm rounded-full focus:ring-1 focus:ring-red-500/30 focus:border-red-500/50 block w-44 focus:w-64 pl-10 py-1.5 transition-all duration-500 ease-out placeholder-neutral-600 outline-none shadow-inner"
            />
          </form>

          <button
            className="md:hidden flex items-center justify-center text-neutral-400 hover:text-white p-2 w-10 h-10 outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <i
              className={`fas ${isMobileMenuOpen ? "fa-times text-2xl" : "fa-bars text-xl"} transition-all duration-300`}
            ></i>
          </button>
        </div>
      </div>

      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10 ${
          isMobileMenuOpen
            ? "max-h-64 opacity-100 py-4"
            : "max-h-0 opacity-0 py-0 border-transparent"
        }`}
      >
        <div className="flex flex-col px-6 gap-4 text-base font-medium">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`block py-2 ${
                isActive(item.href)
                  ? "text-white font-bold"
                  : "text-neutral-300 hover:text-white"
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
              className="absolute inset-y-0 left-0 flex items-center pl-3.5 cursor-pointer z-10"
            >
              <i className="fas fa-search text-neutral-500 group-focus-within:text-white group-hover:text-white transition-colors"></i>
            </button>

            <input
              name="q"
              type="text"
              placeholder="搜索"
              className="bg-white/5 border border-white/10 text-white text-sm rounded-lg block w-full pl-10 py-2.5 outline-none focus:border-red-500/50"
            />
          </form>
        </div>
      </div>
    </nav>
  );
}
