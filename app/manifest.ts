import type { MetadataRoute } from "next";

/** 为 PWA 提供站点应用清单，支持桌面与移动端添加为独立应用。 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "bingetrack.ing - 个人媒体记录平台",
    short_name: "bingetrack",
    description: "记录、检索并回顾电影与电视剧观看历程。",
    start_url: "/",
    display: "standalone",
    background_color: "#140606",
    theme_color: "#140606",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

