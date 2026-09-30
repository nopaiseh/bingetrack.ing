import "server-only";
import { unstable_cache } from "next/cache";
import { MEDIA_LISTS_TAG, MEDIA_TAG } from "./media-cache-tags";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import type { FetchMediaListOptions } from "@/lib/types";

type NamedOption = { name: string };
type ReleaseYearOption = { release_year: string | number };

export type SearchOptions = {
  genres: string[];
  regions: string[];
  languages: string[];
  years: string[];
};

/** 并行读取类型、地区、语言和发行年份选项，任一查询失败即抛错。 */
async function fetchSearchOptions(): Promise<SearchOptions> {
  const db = getSupabasePublicServer();
  const [genresRes, regionsRes, languagesRes, yearsRes] = await Promise.all([
    db.from("genres").select("name").order("name", { ascending: true }),
    db.from("regions").select("name").order("name", { ascending: true }),
    db.from("languages").select("name").order("name", { ascending: true }),
    db.from("release_year_stats").select("release_year").neq("release_year", "All Time").order("release_year", { ascending: false }),
  ]);
  const error = genresRes.error ?? regionsRes.error ?? languagesRes.error ?? yearsRes.error;
  if (error) throw error;

  return {
    genres: ((genresRes.data ?? []) as NamedOption[]).map(/* 提取类型选项名称。 */ ({ name }) => name),
    regions: ((regionsRes.data ?? []) as NamedOption[]).map(/* 提取地区选项名称。 */ ({ name }) => name),
    languages: ((languagesRes.data ?? []) as NamedOption[]).map(/* 提取语言选项名称。 */ ({ name }) => name),
    years: ((yearsRes.data ?? []) as ReleaseYearOption[]).map(/* 将发行年份统一转为字符串选项。 */ ({ release_year }) => String(release_year)),
  };
}

/** 类型、地区、语言筛选的每个值都必须是现有选项；它们会拼进 PostgREST 的数组条件，也决定数据缓存键。 */
export function hasOnlyKnownTagFilters(params: Pick<FetchMediaListOptions, "genre" | "region" | "language">, options: SearchOptions): boolean {
  const within = (value: string | null | undefined, allowed: string[]) =>
    !value || value.split(",").every(/* 检查每个筛选值是否属于已知选项。 */ (item) => allowed.includes(item));
  return within(params.genre, options.genres) && within(params.region, options.regions) && within(params.language, options.languages);
}

export const fetchSearchOptionsServer = unstable_cache(fetchSearchOptions, ["search-options-v2"], {
  revalidate: 86400,
  tags: [MEDIA_TAG, MEDIA_LISTS_TAG],
});
