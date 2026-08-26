import type { Metadata } from "next";
import { GeistMono } from 'geist/font/mono';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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

      <body className="text-neutral-200 font-sans leading-normal tracking-normal selection:bg-red-500/30 selection:text-white flex flex-col min-h-screen relative">
        
        {/* --- 1. THE UNDER-LAYER (What sits behind the glass) --- */}
        {/* Deepened base gradient to keep the overall backdrop darker and calmer */}
        <div className="fixed inset-0 z-[-2] bg-linear-to-br from-[#0c0202] via-[#050202] to-[#0a0202] overflow-hidden pointer-events-none">
          
          {/* Main ambient glow - reduced opacity from 15% down to 6% for a much duller, softer red tint */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250vw] h-[250vh] md:w-[150vw] md:h-[150vh] rounded-[100%] bg-red-600/6 blur-[140px] md:blur-[220px]"></div>
          
          {/* Subtle corner safety glows - reduced opacity to 4% */}
          <div className="absolute -top-[50%] -left-[50%] w-[150vw] h-[150vw] bg-red-700/4 blur-[120px] md:blur-[180px] rounded-full"></div>
          <div className="absolute -bottom-[50%] -right-[50%] w-[150vw] h-[150vw] bg-red-700/4 blur-[120px] md:blur-[180px] rounded-full"></div>

          {/* Dotted grid texture - reduced opacity so it stays subtle */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:24px_24px] opacity-40"></div>
        </div>

        {/* --- 2. THE FULL-SCREEN HEAVY GLASS PANE --- */}
        {/* Slightly deepened glass overlay (bg-black/30) to smooth out the background glow further */}
        <div className="fixed inset-0 z-[-1] bg-black/30 backdrop-blur-xl border-x border-white/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.2)] pointer-events-none"></div>

        <Navbar />

        <main className="flex-1 flex flex-col relative z-1">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}