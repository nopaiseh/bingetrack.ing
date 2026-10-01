import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/lib/themes";

/** 为 PWA 提供站点应用清单，支持桌面与移动端添加为独立应用。 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "bingetrack.ing - 个人媒体记录平台",
    short_name: "bingetrack",
    description: "记录、检索并回顾电影与电视节目观看历程。",
    start_url: "/",
    display: "standalone",
    background_color: THEME_COLORS.default,
    theme_color: THEME_COLORS.default,
    // PWA 主屏图标安装后无法动态更换，固定为默认主题的粉色。monochrome 供 Android 13+ 主题图标使用，不能依赖它一定生效。
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-monochrome-192.png", sizes: "192x192", type: "image/png", purpose: "monochrome" },
      { src: "/icons/icon-monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}

