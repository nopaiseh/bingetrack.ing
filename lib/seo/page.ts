import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

const SITE_NAME = "bingetrack.ing";
const SITE_DESCRIPTION = "记录、检索并回顾电影与电视节目观看历程。";

// 子路由一旦声明 openGraph / twitter，会整段替换根布局的分享配置，因此带上站点身份和默认分享图。
const DEFAULT_SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "bingetrack.ing 个人媒体记录平台",
  type: "image/png",
};

/** 为栏目页生成与页面标题、描述和地址一致的 Open Graph 与 Twitter 元数据。 */
export function buildPageSocialMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: "bingetrack.ing",
      title,
      description,
      url: path,
      images: [DEFAULT_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_SHARE_IMAGE],
    },
  };
}

/**
 * 生成首页 WebSite 结构化数据。
 * 搜索动作使用搜索页实际读取的 q 参数，占位符按 schema.org SearchAction 的 query-input 写法。
 */
export function buildWebsiteJsonLd(): Record<string, unknown> {
  // 与首页规范地址一致：metadataBase 解析 "/" 后不保留末尾斜杠。
  const siteUrl = SITE_URL.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
