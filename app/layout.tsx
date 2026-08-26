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
        <div className="fixed inset-0 z-[-2] bg-[#050505] overflow-hidden pointer-events-none">
          {/* Ambient red lights glowing from all 4 corners */}
          <div className="absolute top-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-red-500/20 blur-[120px]"></div>
          <div className="absolute top-[-20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-red-500/15 blur-[100px]"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-red-500/15 blur-[100px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-red-500/20 blur-[120px]"></div>
          
          {/* NEW: Massive central core glow to illuminate the middle of the screen */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-red-500/15 blur-[150px]"></div>

          {/* Dotted grid texture */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[length:24px_24px] opacity-60"></div>
        </div>

        {/* --- 2. THE FULL-SCREEN HEAVY GLASS PANE --- */}
        <div className="fixed inset-0 z-[-1] bg-black/20 backdrop-blur-xl border-x border-white/5 shadow-[inset_0_0_80px_rgba(0,0,0,0.6)] pointer-events-none"></div>

        <Navbar />

        <main className="flex-1 flex flex-col relative z-1">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}