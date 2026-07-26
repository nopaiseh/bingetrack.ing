"use client";

import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="fixed w-full z-50 top-0 left-0 bg-[#0a0a0a]/40 backdrop-blur-md border-b border-white/5 transition-all duration-300">
      <div className="flex items-center justify-between w-full mx-auto px-6 md:px-8 h-16 max-w-7xl">
        
        {/* 左侧：Logo 和 桌面端链接 */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer" onClick={closeMenu}>
            <i className="fas fa-terminal text-red-500 text-base group-hover:rotate-12 transition-transform duration-300"></i>
            <span className="text-xl font-bold tracking-[0.18em] lowercase font-mono">
              <span className="text-white">nopaiseh</span>
              <span className="text-red-500 font-black">.</span>
            </span>
          </Link>

          {/* 桌面端菜单（移动端隐藏） */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="/" className="text-neutral-400 hover:text-white transition-colors duration-300">首页</Link>
            <Link href="/movies" className="text-neutral-400 hover:text-white transition-colors duration-300">电影</Link>
            <Link href="/series" className="text-neutral-400 hover:text-white transition-colors duration-300">电视剧</Link>
          </div>
        </div>

        {/* 右侧：搜索和汉堡包按钮 */}
        <div className="flex items-center gap-5">
          {/* 搜索框 */}
          <div className="relative group hidden sm:block">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <i className="fas fa-search text-neutral-500 group-focus-within:text-neutral-300 transition-colors"></i>
            </div>
            <input
              type="text"
              placeholder="搜索"
              className="bg-white/5 border border-white/10 text-white text-sm rounded-full focus:ring-1 focus:ring-red-500/30 focus:border-red-500/50 block w-44 focus:w-64 pl-10 py-1.5 transition-all duration-500 ease-out placeholder-neutral-600 outline-none shadow-inner"
            />
          </div>

          {/* 移动端汉堡包/关闭按钮*/}
          <button 
            className="md:hidden flex items-center justify-center text-neutral-400 hover:text-white p-2 w-10 h-10 outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {/* 根据状态切换图标：打开时显示 X，关闭时显示汉堡包 */}
            <i className={`fas ${isMobileMenuOpen ? 'fa-times text-2xl' : 'fa-bars text-xl'} transition-all duration-300`}></i>
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      <div 
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10 ${
          isMobileMenuOpen ? "max-h-64 opacity-100 py-4" : "max-h-0 opacity-0 py-0 border-transparent"
        }`}
      >
        <div className="flex flex-col px-6 gap-4 text-base font-medium">
          <Link href="/" className="text-neutral-300 hover:text-white block py-2" onClick={closeMenu}>
            首页
          </Link>
          <Link href="/movies" className="text-neutral-300 hover:text-white block py-2" onClick={closeMenu}>
            电影
          </Link>
          <Link href="/series" className="text-neutral-300 hover:text-white block py-2" onClick={closeMenu}>
            电视剧
          </Link>
          
          {/* 移动端搜索框 */}
          <div className="relative mt-2 sm:hidden">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <i className="fas fa-search text-neutral-500"></i>
            </div>
            <input type="text" placeholder="搜索" className="bg-white/5 border border-white/10 text-white text-sm rounded-lg block w-full pl-10 py-2.5 outline-none focus:border-red-500/50"/>
          </div>
        </div>
      </div>
    </nav>
  );
}