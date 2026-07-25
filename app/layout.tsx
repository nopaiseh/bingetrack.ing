import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "nopaiseh",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"/>
      </head>

      <body className="bg-[#0a0a0a] text-neutral-200 font-sans leading-normal tracking-normal selection:bg-neutral-700 selection:text-white flex flex-col">
        
        {/* 全局导航栏 */}
        <nav className="fixed w-full z-50 top-0 left-0 bg-[#0a0a0a]/40 backdrop-blur-md border-b border-white/4 transition-all duration-300">
          <div className="flex items-center justify-between w-full mx-auto px-6 md:px-8 h-16 max-w-7xl">
            
            <div className="flex items-center gap-10">
              <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
                <i className="fas fa-terminal text-red-500 text-base group-hover:rotate-12 transition-transform duration-300"></i>
                <span className="text-xl font-bold tracking-[0.18em] lowercase font-mono">
                  <span className="text-white">nopaiseh</span>
                  <span className="text-red-500 font-black">.</span>
                </span>
              </Link>

              <div className="hidden md:flex items-center gap-8 text-sm font-medium">
                <Link href="/" className="text-neutral-400 hover:text-white transition-colors duration-300">
                  首页
                </Link>
                <Link href="/movies" className="text-neutral-400 hover:text-white transition-colors duration-300">
                  电影
                </Link>
                <Link href="/series" className="text-neutral-400 hover:text-white transition-colors duration-300">
                  电视剧
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="relative group hidden sm:block">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <i className="fas fa-search text-neutral-500 group-focus-within:text-neutral-300 transition-colors"></i>
                </div>
                <input
                  type="text"
                  placeholder="搜索"
                  className="bg-white/3 border border-white/10 text-white text-sm rounded-full focus:ring-1 focus:ring-red-500/30 focus:border-red-500/50 block w-44 focus:w-64 pl-10 py-1.5 transition-all duration-500 ease-out placeholder-neutral-600 outline-none shadow-inner"
                />
              </div>
              <div className="md:hidden flex items-center cursor-pointer text-neutral-400 hover:text-white p-2">
                <i className="fas fa-bars text-xl"></i>
              </div>
            </div>

          </div>
        </nav>

        {/* 页面内容 */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* 全局页脚 */}
        <footer className="relative bg-[#0a0a0a] mt-auto py-6 overflow-hidden border-t border-white/5">
          
          {/* 顶部边框光晕 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-linear-to-r from-transparent via-red-500/30 to-transparent"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-px bg-linear-to-r from-transparent via-red-500/80 to-transparent blur-[2px]"></div>

          <div className="container mx-auto px-6 md:px-8 max-w-7xl">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              
              {/* 左侧：品牌与版权 */}
              <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 shrink-0">
                <Link href="/" className="flex items-center gap-2 group cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-300">
                  <i className="fas fa-terminal text-red-500/90 text-sm group-hover:rotate-12 transition-transform duration-300"></i>
                  <span className="text-base font-bold tracking-[0.18em] lowercase font-mono">
                    <span className="text-white">nopaiseh</span>
                    <span className="text-red-500 font-black">.</span>
                  </span>
                </Link>
                <span className="hidden sm:block text-white/10">|</span>
                <span className="text-neutral-500 text-xs font-mono">
                  &copy; 1990 - {new Date().getFullYear()} All Rights Reserved.
                </span>
              </div>

              {/* 右侧：致谢信息 */}
              <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 md:gap-5">
                {/* 技术栈 */}
                <div className="flex items-center gap-2">
                  <a href="https://nextjs.org/" target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-white/2 border border-white/5 text-neutral-400 text-[10px] font-mono hover:text-white hover:border-white/20 hover:bg-white/5 transition-all">
                    Next.js
                  </a>
                  <a href="https://supabase.com/" target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-[#3ECF8E]/5 border border-[#3ECF8E]/20 text-[#3ECF8E]/80 text-[10px] font-mono hover:text-[#3ECF8E] hover:border-[#3ECF8E]/40 hover:bg-[#3ECF8E]/10 transition-all">
                    Supabase
                  </a>
                  <a href="https://tailwindcss.com/" target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-[#38BDF8]/5 border border-[#38BDF8]/20 text-[#38BDF8]/80 text-[10px] font-mono hover:text-[#38BDF8] hover:border-[#38BDF8]/40 hover:bg-[#38BDF8]/10 transition-all">
                    Tailwind
                  </a>
                </div>

                <span className="hidden md:block text-white/10">|</span>

                {/* TMDB */}
                <div className="flex items-center gap-2 text-xs text-neutral-500 bg-white/2 px-2.5 py-1 rounded-md border border-white/5">
                  <span className="scale-90 whitespace-nowrap">海报提供</span>
                  <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="opacity-70 hover:opacity-100 transition-opacity duration-300 flex items-center py-0.5">
                    <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB Logo" className="h-2.5"/>
                  </a>
                </div>

                {/* Github */}
                <a href="https://github.com/nopaiseh/nopaiseh" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors duration-300" aria-label="在GitHub上查看源码">
                  <i className="fab fa-github text-lg"></i>
                </a>
              </div>

            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}