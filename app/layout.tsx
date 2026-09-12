import { Suspense } from "react";
import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NavigationProgressBar from "@/components/NavigationProgressBar";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "bingetrack.ing - 个人媒体记录平台",
    template: "%s | bingetrack.ing",
  },
  description: "记录、检索并回顾电影与电视剧观看历程。",
  applicationName: "bingetrack.ing",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "bingetrack.ing",
    title: "bingetrack.ing - 个人媒体记录平台",
    description: "记录、检索并回顾电影与电视剧观看历程。",
  },
};

/** 设置中文文档、全局导航、页脚和主要内容容器，并挂载性能统计与路由流转组件。 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-[var(--canvas)] text-white/90 font-sans leading-normal tracking-normal selection:bg-red-500/30 selection:text-white flex flex-col min-h-screen relative">
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>

        <a
          href="#main-content"
          className="surface-raised fixed left-4 top-4 z-100 -translate-y-24 rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0"
        >
          跳到主要内容
        </a>
        
        <Navbar />

        <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col relative z-1">
          {children}
        </main>

        <Footer />
        <SpeedInsights />
      </body>
    </html>
  );
}

