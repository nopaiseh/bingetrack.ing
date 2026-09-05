import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getMediaById, getSeasonsBySeriesId, searchMediaServer } from "./media-repo";
import { parseMediaSearchParams } from "@/lib/api/media-params";

// Public data only. Arguments are part of the cache key; React cache also
// deduplicates metadata/body reads within the same render.
export const getCachedMediaById = cache(unstable_cache(getMediaById, ["public-media-detail-v1"], {
  revalidate: 60,
  tags: ["media"],
}));

export const getCachedSeasonsBySeriesId = cache(unstable_cache(getSeasonsBySeriesId, ["public-media-seasons-v1"], {
  revalidate: 60,
  tags: ["media"],
}));

export const searchCachedMedia = unstable_cache(
  async (query: string) => searchMediaServer(parseMediaSearchParams(new URLSearchParams(query))),
  ["public-media-search-v1"],
  { revalidate: 30, tags: ["media"] },
);
