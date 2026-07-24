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
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0a0a0a] text-neutral-200 font-sans leading-normal tracking-normal min-h-screen selection:bg-neutral-700 selection:text-white flex flex-col">
        {/* Global Navbar */}
        <nav className="fixed w-full z-50 top-0 left-0 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-white/5 transition-all duration-300">
          <div className="flex items-center justify-between w-full mx-auto px-6 md:px-8 h-16 max-w-7xl">
            <div className="flex items-center gap-10">
              <Link
                href="/"
                className="flex items-center gap-2.5 group cursor-pointer"
              >
                <i className="fas fa-terminal text-red-500 text-base group-hover:rotate-12 transition-transform duration-300"></i>
                <span className="text-xl font-bold tracking-[0.18em] lowercase font-mono">
                  <span className="text-white">nopaiseh</span>
                  <span className="text-red-500 font-black">.</span>
                </span>
              </Link>

              <div className="hidden md:flex items-center gap-8 text-sm font-medium">
                <Link
                  href="/"
                  className="text-neutral-400 hover:text-white transition-colors duration-300"
                >
                  首页
                </Link>
                <Link
                  href="/movies"
                  className="text-neutral-400 hover:text-white transition-colors duration-300"
                >
                  电影
                </Link>
                <Link
                  href="/series"
                  className="text-neutral-400 hover:text-white transition-colors duration-300"
                >
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
                  className="bg-white/[0.03] border border-white/10 text-white text-sm rounded-full focus:ring-1 focus:ring-red-500/30 focus:border-red-500/50 block w-44 focus:w-64 pl-10 py-1.5 transition-all duration-500 ease-out placeholder-neutral-600 outline-none shadow-inner"
                />
              </div>

              <div className="md:hidden flex items-center cursor-pointer text-neutral-400 hover:text-white p-2">
                <i className="fas fa-bars text-xl"></i>
              </div>
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <div className="pt-16 flex-1">{children}</div>

        {/* Global Footer */}
        <footer className="relative bg-[#0a0a0a] mt-auto pt-12 pb-8 overflow-hidden">
          {/* Subtle top border glow to match your red accent */}
          <div className="absolute top-0 left-0 w-full h-px bg-white/5"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent"></div>

          <div className="container mx-auto px-6 md:px-8 max-w-7xl">
            {/* Main Footer Content */}
            <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mb-10">
              {/* Brand & Tagline */}
              <div className="flex flex-col items-center md:items-start gap-3">
                <Link
                  href="/"
                  className="flex items-center gap-2 group cursor-pointer opacity-80 hover:opacity-100 transition-opacity duration-300"
                >
                  <i className="fas fa-terminal text-red-500/80 text-sm group-hover:rotate-12 transition-transform duration-300"></i>
                  <span className="text-lg font-bold tracking-[0.18em] lowercase font-mono">
                    <span className="text-white/90">nopaiseh</span>
                    <span className="text-red-500/80 font-black">.</span>
                  </span>
                </Link>
                <p className="text-neutral-500 text-xs font-medium tracking-wide">
                  我的个人媒体库
                </p>
              </div>

              {/* Navigation / Social Links */}
              <div className="flex items-center gap-6 text-sm text-neutral-400">
                <Link
                  href="/movies"
                  className="hover:text-white hover:underline underline-offset-4 decoration-red-500/50 transition-all duration-300"
                >
                  电影
                </Link>
                <Link
                  href="/series"
                  className="hover:text-white hover:underline underline-offset-4 decoration-red-500/50 transition-all duration-300"
                >
                  电视剧
                </Link>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-500 hover:text-white transition-colors duration-300"
                >
                  <i className="fab fa-github text-lg"></i>
                </a>
              </div>
            </div>

            {/* Bottom Bar: Copyright & Attribution */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
              <div className="text-neutral-600 text-xs font-mono">
                &copy; {new Date().getFullYear()} nopaiseh. All rights reserved.
              </div>

              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="hidden sm:inline-block">Posters by</span>
                <a
                  href="https://www.themoviedb.org/"
                  target="_blank"
                  rel="noreferrer"
                  className="opacity-50 hover:opacity-100 transition-opacity duration-300"
                >
                  <img
                    src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                    alt="TMDB Logo"
                    className="h-3"
                  />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
