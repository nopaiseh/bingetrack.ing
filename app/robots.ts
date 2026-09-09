import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** 允许抓取公开页面、排除 API 路径，并声明站点地图地址。 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/login", "/auth/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
