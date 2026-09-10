import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";

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

export const fetchSearchOptionsServer = unstable_cache(fetchSearchOptions, ["search-options-v1"], {
  revalidate: 3600,
  tags: ["media"],
});
