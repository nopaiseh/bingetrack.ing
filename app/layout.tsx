import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "nopaiseh tracker",
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
      <body className="bg-[#0f0f0f] text-white font-sans leading-normal tracking-normal min-h-screen">
        {/* Global Navbar */}
        <nav className="bg-[#0f0f0f] fixed w-full z-20 top-0 left-0 border-b border-neutral-800">
          <div className="flex items-center justify-between w-full mx-auto px-6 md:px-8 py-3 max-w-7xl">
            <div className="flex items-center space-x-8">
              <Link
                href="/"
                className="flex items-center space-x-2.5 cursor-pointer"
              >
                <i className="fas fa-dashboardx  text-red-600 text-lg"></i>
                <span className="text-lg font-bold tracking-wide text-red-600 uppercase">
                  nopaiseh
                </span>
              </Link>
              <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
                <Link
                  href="/"
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  首页
                </Link>
                <Link
                  href="/movie"
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  电影
                </Link>
                <Link
                  href="/tv"
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  电视剧
                </Link>
              </div>
            </div>

            <div className="flex items-center space-x-4 -mr-4">
              <div className="relative group hidden sm:block">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <i className="fas fa-search text-neutral-500 group-focus-within:text-white transition-colors"></i>
                </div>
                <input
                  type="text"
                  placeholder="搜索"
                  className="bg-neutral-900 border border-neutral-700 text-white text-sm rounded focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 block w-40 focus:w-56 pl-9 p-1.5 transition-all duration-300 ease-in-out placeholder-neutral-600 outline-none"
                />
              </div>
              <div className="md:hidden flex items-center cursor-pointer text-neutral-400 hover:text-white">
                <i className="fas fa-bars text-xl"></i>
              </div>
            </div>
          </div>
        </nav>

        {/* Page Content goes here */}
        <div className="pt-20">{children}</div>
      </body>
    </html>
  );
}