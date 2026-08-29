import Link from "next/link";
import { Terminal } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative z-1 bg-white/5 backdrop-blur-2xl mt-auto py-6 overflow-hidden border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.2)] transition-all duration-300">
      
      {/* Subdued fixed white gradient syntax for dark theme */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-linear-to-r from-transparent via-white/10 to-transparent"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-px bg-linear-to-r from-transparent via-white/20 to-transparent blur-[2px]"></div>

      <div className="container mx-auto px-6 md:px-8 max-w-7xl">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-300">
              <Terminal className="size-4 text-red-500 group-hover:rotate-12 group-hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-300" aria-hidden="true" />
              {/* Glass-like Gradient Text matching Navbar */}
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
            <span className="hidden sm:block text-white/20">|</span>
            <span className="text-white/60 text-xs font-mono">
              &copy; 1990 - {new Date().getFullYear()} 个人媒体记录平台
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 md:gap-5">
            
            {/* Tech badges */}
            <div className="flex items-center gap-2">
              <a href="https://nextjs.org/" target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-white/5 backdrop-blur-md border border-white/10 text-neutral-400 text-[10px] font-mono hover:text-white hover:border-white/20 hover:bg-white/10 hover:shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-all duration-300">
                Next.js
              </a>
              <a href="https://supabase.com/" target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-[#3ECF8E]/10 backdrop-blur-md border border-[#3ECF8E]/20 text-[#3ECF8E]/90 text-[10px] font-mono hover:text-[#3ECF8E] hover:border-[#3ECF8E]/40 hover:bg-[#3ECF8E]/20 hover:shadow-[0_0_10px_rgba(62,207,142,0.2)] transition-all duration-300">
                Supabase
              </a>
              <a href="https://tailwindcss.com/" target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-[#38BDF8]/10 backdrop-blur-md border border-[#38BDF8]/20 text-[#38BDF8]/90 text-[10px] font-mono hover:text-[#38BDF8] hover:border-[#38BDF8]/40 hover:bg-[#38BDF8]/20 hover:shadow-[0_0_10px_rgba(56,189,248,0.2)] transition-all duration-300">
                Tailwind
              </a>
            </div>

            <span className="hidden md:block text-white/20">|</span>

            <a href="https://github.com/nopaiseh/nopaiseh" target="_blank" rel="noreferrer" className="text-white/50 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all duration-300" aria-label="在GitHub上查看源码">
              <svg className="size-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.26 3.38.97.1-.75.4-1.26.74-1.55-2.57-.3-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
              </svg>
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
}
