import type { Metadata } from "next";

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
