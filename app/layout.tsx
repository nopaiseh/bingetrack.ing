import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import HideOnAdmin from "@/components/HideOnAdmin";
import NavigationProgressBar from "@/components/NavigationProgressBar";
import { SITE_URL } from "@/lib/site";
import { FAVICON_PNG_ID, FAVICON_SVG_ID, THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/themes";
import "./globals.css";

// 界面与数字都经 next/font 自托管，满足 font-src 'self'。
// Noto Sans SC 的 next/font 子集不含汉字，中文走字体栈里的 Noto Sans SC / 思源黑体。
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
  fallback: ["Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", "Source Han Sans"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  fallback: ["Noto Sans Mono CJK SC"],
});

export const viewport: Viewport = {
  themeColor: THEME_COLORS.default,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "bingetrack.ing - 个人媒体记录平台",
    template: "%s | bingetrack.ing",
  },
  description: "记录、检索并回顾电影与电视节目观看历程。",
  applicationName: "bingetrack.ing",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "bingetrack.ing",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "bingetrack.ing",
    title: "bingetrack.ing - 个人媒体记录平台",
    description: "记录、检索并回顾电影与电视节目观看历程。",
  },
};

/** 设置中文文档、全局导航、页脚和主要内容容器，并挂载性能统计与路由流转组件。 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        {/* 标签页图标随主题切换，初始为默认粉色；THEME_INIT_SCRIPT 与 ThemeToggle 会按 id 改写 href。 */}
        <link rel="icon" id={FAVICON_SVG_ID} type="image/svg+xml" href="/icons/favicon-pink.svg" suppressHydrationWarning />
        <link rel="icon" id={FAVICON_PNG_ID} type="image/png" sizes="32x32" href="/icons/favicon-pink-32.png" suppressHydrationWarning />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
      </head>
      <body className="bg-[var(--canvas)] text-fg font-sans leading-normal tracking-normal selection:bg-[var(--accent-soft)] selection:text-white flex flex-col min-h-screen relative transition-colors duration-500">
        <div aria-hidden="true" className="film-grain-overlay" />
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>

        <a
          href="#main-content"
          className="surface-raised fixed left-4 top-4 z-100 -translate-y-24 rounded-lg border border-[var(--accent-border)] focus:border-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0"
        >
          跳到主要内容
        </a>
        
        <HideOnAdmin>
          <Navbar />
        </HideOnAdmin>

        <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col relative z-1">
          {children}
        </main>

        <HideOnAdmin>
          <Footer />
        </HideOnAdmin>
        <HideOnAdmin>
          <MobileTabBar />
        </HideOnAdmin>
        <SpeedInsights />
      </body>
    </html>
  );
}

