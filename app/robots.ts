import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** 允许抓取公开页面、排除 API／后台路径与带查询参数的搜索页，并声明站点地图地址。 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /search? 挡住带参数的筛选组合；无参数 /search 仍可抓（sitemap 不收录，页面自身可索引）。
      disallow: ["/api/", "/manage", "/settings", "/auth/", "/search?"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
