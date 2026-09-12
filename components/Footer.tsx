import Link from "next/link";

/** 渲染站点页脚、品牌链接及所用平台标识。 */
export default function Footer() {
  return (
    <footer className="surface-panel content-visibility-auto relative z-1 mt-auto overflow-hidden border-x-0 border-b-0 py-6 transition-all duration-300">
      
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-linear-to-r from-transparent via-white/10 to-transparent"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-px bg-linear-to-r from-transparent via-white/20 to-transparent blur-[2px]"></div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-300">
              <span className="i-material-symbols-terminal-rounded inline-block size-4 text-red-500 group-hover:rotate-12 group-hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-300" aria-hidden="true" />
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
            <span className="hidden sm:block text-white/20">|</span>
            <span className="text-white/60 text-xs font-mono">
              &copy; 1990 - {new Date().getFullYear()} 个人媒体记录平台
            </span>
          </div>

          <div className="flex items-center justify-center lg:justify-end gap-3.5 sm:gap-4 text-white/50">
            
            <a
              href="https://nextjs.org/"
              target="_blank"
              rel="noreferrer"
              title="Next.js"
              aria-label="Next.js"
              className="hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] transition-all duration-300"
            >
              <svg className="size-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.665 21.162V7.124h2.15v14.038h-2.15zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c3.059 0 5.868-1.15 8.007-3.045L8.528 7.124H6.299v9.714h1.996V9.658l10.89 13.064A11.94 11.94 0 0 0 12 24C5.373 24 0 18.627 0 12S5.373 0 12 0z" />
              </svg>
            </a>

            <a
              href="https://unocss.dev/"
              target="_blank"
              rel="noreferrer"
              title="UnoCSS"
              aria-label="UnoCSS"
              className="hover:text-[#FAD000] hover:drop-shadow-[0_0_8px_rgba(250,208,0,0.8)] transition-all duration-300"
            >
              <svg className="size-4.5 fill-current" viewBox="0 0 220 220" aria-hidden="true">
                <path d="M117.444 167.888C117.444 140.273 139.83 117.888 167.444 117.888V117.888C195.058 117.888 217.444 140.273 217.444 167.888V167.888C217.444 195.502 195.058 217.888 167.444 217.888V217.888C139.83 217.888 117.444 195.502 117.444 167.888V167.888Z" opacity="0.8" />
                <path d="M117.444 53C117.444 25.3858 139.83 3 167.444 3V3C195.058 3 217.444 25.3858 217.444 53V98C217.444 100.761 215.205 103 212.444 103H122.444C119.683 103 117.444 100.761 117.444 98V53Z" />
                <path d="M102 167.888C102 195.502 79.6142 217.888 52 217.888V217.888C24.3858 217.888 2 195.502 2 167.888L2 122.888C2 120.126 4.23859 117.888 7 117.888L97 117.888C99.7614 117.888 102 120.126 102 122.888L102 167.888Z" opacity="0.6" />
              </svg>
            </a>

            <a
              href="https://supabase.com/"
              target="_blank"
              rel="noreferrer"
              title="Supabase"
              aria-label="Supabase"
              className="hover:text-[#3ECF8E] hover:drop-shadow-[0_0_8px_rgba(62,207,142,0.8)] transition-all duration-300"
            >
              <svg className="size-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21.362 9.354H12V.312a.312.312 0 0 0-.533-.22L.15 11.373a.625.625 0 0 0 .442 1.069H12v9.042a.312.312 0 0 0 .533.22l11.317-11.28a.625.625 0 0 0-.488-1.07Z" />
              </svg>
            </a>

            <a
              href="https://vercel.com/"
              target="_blank"
              rel="noreferrer"
              title="Vercel"
              aria-label="Vercel"
              className="hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300"
            >
              <svg className="size-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 22.525H0l12-21.05 12 21.05z" />
              </svg>
            </a>

            <a
              href="https://sentry.io/"
              target="_blank"
              rel="noreferrer"
              title="Sentry"
              aria-label="Sentry"
              className="hover:text-[#C9C1F0] hover:drop-shadow-[0_0_8px_rgba(108,95,199,0.8)] transition-all duration-300"
            >
              <svg className="size-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13.036 0c.937 0 1.764.57 2.1 1.442l8.72 20.316a2.29 2.29 0 0 1-2.11 3.197c-.8 0-1.53-.417-1.928-1.096l-2.072-3.535a9.353 9.353 0 0 0-4.148.974l1.246 2.126a.573.573 0 0 1-.497.864c-.2 0-.383-.104-.482-.274l-1.396-2.383a9.42 9.42 0 0 0-1.89.043l.896 1.53c.123.21.123.47 0 .68a.784.784 0 0 1-.68.397c-.25 0-.482-.132-.605-.345L8.74 21.22a9.37 9.37 0 0 0-1.396.657l.55 1.055a.573.573 0 0 1-.508.84c-.214 0-.412-.116-.513-.306l-.768-1.472A9.395 9.395 0 0 0 2.29 19.49a2.29 2.29 0 0 1-.365-4.55 9.4 9.4 0 0 0 5.485-2.834L11.028 1.48A2.29 2.29 0 0 1 13.036 0Z" />
              </svg>
            </a>

            <span className="text-white/20">|</span>

            <a href="https://github.com/nopaiseh/bingetrack.ing" target="_blank" rel="noreferrer" className="hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all duration-300" title="GitHub" aria-label="在GitHub上查看源码">
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
