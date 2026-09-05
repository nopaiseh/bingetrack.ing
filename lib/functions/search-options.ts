import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabasePublicServer } from "@/utils/supabase";

type NamedOption = { name: string };
type ReleaseYearOption = { release_year: string | number };

export type SearchOptions = {
  genres: string[];
  regions: string[];
  languages: string[];
  years: string[];
};

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
    genres: ((genresRes.data ?? []) as NamedOption[]).map(({ name }) => name),
    regions: ((regionsRes.data ?? []) as NamedOption[]).map(({ name }) => name),
    languages: ((languagesRes.data ?? []) as NamedOption[]).map(({ name }) => name),
    years: ((yearsRes.data ?? []) as ReleaseYearOption[]).map(({ release_year }) => String(release_year)),
  };
}

export const fetchSearchOptionsServer = unstable_cache(fetchSearchOptions, ["search-options-v1"], {
  revalidate: 3600,
  tags: ["media"],
});
