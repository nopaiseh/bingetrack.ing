import type { MetadataRoute } from "next";
import { getSitemapMediaEntries } from "@/lib/functions/media-repo";
import { SITE_URL } from "@/lib/site";
import { reportHandledError } from "@/lib/report-error";

export const revalidate = 86400;

/** 合并固定页面和数据库中的媒体地址生成站点地图；查询失败时退回固定页面列表。 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 不列入 /search：无参数页由导航暴露并保持可索引，筛选组合由页面 robots 标为 noindex，避免和列表页同一优先级。
  const staticRoutes: MetadataRoute.Sitemap = ["", "/movies", "/shows"].map(/* 为固定页面设置绝对地址、更新频率和优先级，首页权重最高。 */ (path) => ({
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
    reportHandledError("Falling back to static sitemap routes:", error);
    return staticRoutes;
  }
}
