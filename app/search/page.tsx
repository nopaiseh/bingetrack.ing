import SearchClient from "./SearchClient";
import { fetchSearchOptionsServer } from "@/lib/functions/search-options";
import { searchCachedMedia } from "@/lib/functions/cached-media";
import { buildMediaSearchQuery } from "@/lib/api/search-state";
import type { MediaCard } from "@/lib/types";

export const revalidate = 3600;

export default async function SearchPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const key = buildMediaSearchQuery(params);
  const [initialOptions, initialResult] = await Promise.all([
    fetchSearchOptionsServer(),
    searchCachedMedia(key).then(
      (data) => ({ ...data, key, error: null }),
      (error: unknown) => {
        console.error("Initial search failed:", error);
        return { rows: [] as MediaCard[], total: 0, key, error: "暂时无法加载搜索结果，请稍后重试。" };
      },
    ),
  ]);
  return <SearchClient key={key} initialOptions={initialOptions} initialResult={initialResult} />;
}
