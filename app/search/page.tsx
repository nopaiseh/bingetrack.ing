import Link from "next/link";
import { getSupabaseServer } from "@/utils/supabase";
import { mapSupabaseToMedia, SupabaseMediaItem } from "@/lib/functions/mediaMapper";
import MediaRow from "@/components/MediaRow";
import { Media } from "@/lib/types/Media";

interface SearchParams {
  q?: string;
  genre?: string;
  region?: string;
  language?: string;
  director?: string;
  cast?: string;
  series?: string;
}

const categoryLabels: Record<string, string> = {
  genre: "类型",
  region: "地区",
  language: "语言",
  director: "导演",
  cast: "主演",
  series: "系列",
};

export const revalidate = 60;

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const category = searchParams?.genre
    ? "genre"
    : searchParams?.region
    ? "region"
    : searchParams?.language
    ? "language"
    : searchParams?.director
    ? "director"
    : searchParams?.cast
    ? "cast"
    : searchParams?.series
    ? "series"
    : searchParams?.q
    ? "q"
    : undefined;

  const queryValue =
    (category && searchParams?.[category as keyof SearchParams]) ||
    searchParams?.q ||
    "";

  if (!queryValue) {
    return (
      <main className="container mx-auto px-6 md:px-8 max-w-7xl py-16">
        <h1 className="text-3xl font-bold text-white mb-4">搜索</h1>
        <p className="text-neutral-400">
          请输入关键词进行搜索，或者从页面中的标签进入筛选结果。
        </p>
      </main>
    );
  }

  const query = getSupabaseServer()
    .from("media_info")
    .select(
      `id, title, summary, cover_url, release_date, type, rating, status,
      media_genres ( genres ( name ) ),
      media_languages ( languages ( name ) ),
      media_regions ( regions ( name ) ),
      media_credits ( people ( name ), role, credit_order ),
      media_series ( name )`,
    )
    .limit(50);

  const filterQuery = (builder: typeof query) => {
    switch (category) {
      case "genre":
        return builder.eq("media_genres.genres.name", queryValue);
      case "region":
        return builder.eq("media_regions.regions.name", queryValue);
      case "language":
        return builder.eq("media_languages.languages.name", queryValue);
      case "director":
        return builder.eq("media_credits.people.name", queryValue).eq(
          "media_credits.role",
          "director",
        );
      case "cast":
        return builder.eq("media_credits.people.name", queryValue).eq(
          "media_credits.role",
          "actor",
        );
      case "series":
        return builder.eq("media_series.name", queryValue);
      default:
        return builder.or(
          `title.ilike.%${queryValue}%,summary.ilike.%${queryValue}%`,
        );
    }
  };

  const { data, error } = (await filterQuery(query)) as {
    data: SupabaseMediaItem[] | null;
    error: unknown;
  };
  const results = (data ?? []).map((item) => {
    const type = item.type === "tv_series" ? "series" : "movies";
    return mapSupabaseToMedia(item, type as "movies" | "series");
  }) as Media[];

  return (
    <main className="container mx-auto px-6 md:px-8 max-w-7xl py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">搜索结果</h1>
        <p className="text-neutral-400">
          {category && category !== "q"
            ? `${categoryLabels[category] || "关键词"}: ${queryValue}`
            : `搜索关键词: ${queryValue}`}
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-6 text-red-200">
          无法加载搜索结果，请稍后重试。
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-neutral-300">
          没有找到匹配的内容。
        </div>
      ) : (
        <div className="space-y-12">
          <MediaRow title="匹配结果" items={results} type="movies" />
        </div>
      )}

      <div className="mt-10 text-sm text-neutral-500">
        <p>提示: 点击页面中的标签可以快速过滤同类内容。</p>
        <Link href="/" className="text-red-400 hover:text-red-300">
          返回首页
        </Link>
      </div>
    </main>
  );
}
