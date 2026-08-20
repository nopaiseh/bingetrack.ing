import type { Metadata } from "next";
import Link from "next/link";
import { GeistMono } from 'geist/font/mono';
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "bingewatch.ing - 个人媒体记录平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${GeistMono.variable}`}>
      <head>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"/>
      </head>

      <body className="bg-[#0a0a0a] text-neutral-200 font-sans leading-normal tracking-normal selection:bg-indigo-500/30 selection:text-indigo-100 flex flex-col min-h-screen">
        
        
        <Navbar />

        
        <main className="flex-1 flex flex-col">{children}</main>

        
        <footer className="relative bg-[#0a0a0a] mt-auto py-6 overflow-hidden border-t border-white/5">

          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-linear-to-r from-transparent via-white-500/30 to-transparent"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-px bg-linear-to-r from-transparent via-white-500/80 to-transparent blur-[2px]"></div>

          <div className="container mx-auto px-6 md:px-8 max-w-7xl">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              
              
              <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 shrink-0">
                <Link href="/" className="flex items-center gap-2 group cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-300">
                  <i className="fas fa-terminal text-red-500 text-sm group-hover:rotate-12 transition-transform duration-300"></i>
                  <span className="font-mono text-xl text-white font-light tracking-tight">
                    <span className="text-white">bingewatch</span>
                    <span className="text-red-500 font-black -mx-0.5">.</span>ing
                  </span>
                </Link>
                <span className="hidden sm:block text-white/10">|</span>
                <span className="text-neutral-500 text-xs font-mono">
                  &copy; 1990 - {new Date().getFullYear()} 个人媒体记录平台
                </span>
              </div>

              
              <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 md:gap-5">
                
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

                
                <a href="https://github.com/nopaiseh/nopaiseh" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors duration-300" aria-label="在GitHub上查看源码">
                  <i className="fab fa-github text-lg hover:text-indigo-400 transition-colors"></i>
                </a>
              </div>

            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}