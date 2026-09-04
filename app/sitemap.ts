import type { MetadataRoute } from "next";
import { getSitemapMediaEntries } from "@/lib/functions/media-repo";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/movies", "/series", "/search"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.8,
  }));

  try {
    const media = await getSitemapMediaEntries();
    return [
      ...staticRoutes,
      ...media.map((item) => ({
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
