import Link from "next/link";

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
              <i className="fas fa-terminal text-red-500 text-base group-hover:rotate-12 group-hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-300"></i>
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
              <i className="fab fa-github text-lg"></i>
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
}