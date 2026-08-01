import { getSupabaseServer } from "@/utils/supabase";
import HomeDashboard from "@/app/HomeDashboard";
import { Summary } from "@/lib/types/Summary";

export const revalidate = 60;

export default async function HomePage() {
  const { data: summary } = (await supabaseServer
    .from("release_year_stats")
    .select(
      "release_year, total_movies, total_series, watched_movies, watched_series, movie_avg_rating, series_avg_rating",
    )
    .order("release_year", { ascending: false })) as {
    data: Summary[] | null;
    error: unknown;
  };

  return (
    <main>
      <HomeDashboard summary={summary ?? []} />
    </main>
  );
}