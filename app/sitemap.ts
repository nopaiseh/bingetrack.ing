import type { MetadataRoute } from "next";
import { getSitemapMediaEntries } from "@/lib/functions/media-repo";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

/** 合并固定页面和数据库中的媒体地址生成站点地图；查询失败时退回固定页面列表。 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/movies", "/series", "/search"].map(/* 为固定页面设置绝对地址、更新频率和优先级，首页权重最高。 */ (path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.8,
  }));

  try {
    const media = await getSitemapMediaEntries();
    return [
      ...staticRoutes,
      ...media.map(/* 将媒体相对路径转换成每周更新的站点地图条目。 */ (item) => ({
        url: `${SITE_URL}${item.path}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    console.error("Falling back to static sitemap routes:", error);
    return staticRoutes;
  }
}
