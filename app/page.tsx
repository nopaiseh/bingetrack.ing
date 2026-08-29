import { getSupabaseServer } from "@/utils/supabase";
import HomeDashboard from "@/app/HomeDashboard";
import { Summary } from "@/lib/types";
import { fetchMediaDistributionsServer, fetchTopMediaServer } from "@/lib/functions/media-repo";

export const revalidate = 60;

export default async function HomePage() {
  const db = getSupabaseServer();
  const [summaryRes, topMovies, topSeries, distributions] = await Promise.all([
    db.from("release_year_stats").select("*").order("release_year", { ascending: false }),
    fetchTopMediaServer("movie", null, 10),
    fetchTopMediaServer("tv_series", null, 10),
    fetchMediaDistributionsServer(),
  ]);

  const summary = (summaryRes?.data as Summary[] | null) ?? [];
  const error = summaryRes?.error ?? null;

  if (error) {
    console.error("Failed to fetch release year stats:", error);
  }

  return (
    <main>
      <HomeDashboard summary={summary} topMovies={topMovies ?? []} topSeries={topSeries ?? []} distributions={distributions} />
    </main>
  );
}
