"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, Terminal, X } from "lucide-react";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const closeMenu = () => setIsMobileMenuOpen(false);

  const navItems = [
    { name: "首页", href: "/" },
    { name: "电影", href: "/movies" },
    { name: "电视剧", href: "/series" },
  ];

  const isActive = (href: string) => {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  };

  const handleSearch = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const query = formData.get("q")?.toString().trim() || "";

    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    } else {
      router.push("/search");
    }
  };

  return (
    <nav className="fixed w-full z-50 top-0 left-0 bg-white/5 backdrop-blur-2xl border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all duration-300">
      <div className="flex items-center justify-between w-full mx-auto px-6 md:px-8 h-16 max-w-7xl">
        <div className="flex items-center gap-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 group cursor-pointer"
            onClick={closeMenu}
          >
            <Terminal className="size-4 text-red-500 group-hover:rotate-12 group-hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-300" aria-hidden="true" />
            <span className="font-mono text-xl font-light tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]">
              <span className="bg-clip-text text-transparent bg-linear-to-br from-white via-white/80 to-white/50">
                bingewatch
              </span>
              <span className="text-red-500 font-black -mx-0.5 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                .
              </span>
              <span className="bg-clip-text text-transparent bg-linear-to-br from-white/90 to-white/40">
                ing
              </span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
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

        <div className="flex items-center gap-5">
          <form
            onSubmit={handleSearch}
            className="relative group hidden sm:block"
          >
            <button
              type="submit"
              className="absolute inset-y-0 left-0 flex items-center pl-3.5 cursor-pointer z-10"
            >
              <Search className="size-4 text-white/50 group-focus-within:text-white group-focus-within:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300" aria-hidden="true" />
            </button>
            <input
              name="q"
              type="text"
              placeholder="搜索"
              className="bg-white/5 backdrop-blur-2xl border border-white/10 text-white text-sm rounded-full 
              focus:bg-white/10 focus:ring-1 focus:ring-white/30 focus:border-white/30 
              block w-44 focus:w-64 pl-10 py-1.5 transition-all duration-500 ease-out 
              placeholder-white/40 outline-none 
              shadow-[0_4px_15px_rgba(0,0,0,0.2)] 
              focus:shadow-[0_4px_25px_rgba(255,255,255,0.05)]"
            />
          </form>

          <button
            className="md:hidden flex items-center justify-center text-white/70 hover:text-white p-2 w-10 h-10 outline-none 
            bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full 
            shadow-[0_4px_15px_rgba(0,0,0,0.2)] 
            hover:bg-white/10 hover:border-white/20 hover:shadow-[0_6px_20px_rgba(255,255,255,0.05)] transition-all duration-300"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        className={`md:hidden overflow-hidden transition-all duration-500 ease-in-out bg-white/5 backdrop-blur-3xl border-b border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.2)] ${
          isMobileMenuOpen
            ? "max-h-72 opacity-100 py-4"
            : "max-h-0 opacity-0 py-0 border-transparent"
        }`}
      >
        <div className="flex flex-col px-6 gap-4 text-base font-medium">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
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
              className="absolute inset-y-0 left-0 flex items-center pl-3.5 cursor-pointer z-10"
            >
              <Search className="size-4 text-white/50 group-focus-within:text-white group-focus-within:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300" aria-hidden="true" />
            </button>

            <input
              name="q"
              type="text"
              placeholder="搜索"
              className="bg-white/5 backdrop-blur-2xl border border-white/10 text-white text-sm rounded-xl block w-full pl-10 py-2.5 outline-none 
              focus:bg-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/30
              shadow-[0_4px_15px_rgba(0,0,0,0.2)] 
              focus:shadow-[0_6px_25px_rgba(255,255,255,0.05)] 
              placeholder-white/40 transition-all duration-300"
            />
          </form>
        </div>
      </div>
    </nav>
  );
}
