import { getSupabaseServer } from "@/utils/supabase";
import HomeDashboard from "@/app/HomeDashboard";
import { Summary } from "@/lib/types/media-summary";
import { fetchTopMediaServer } from "@/lib/functions/media-repo";

export const revalidate = 60;

export default async function HomePage() {
  const db = getSupabaseServer();
  const [summaryRes, topMovies, topSeries] = await Promise.all([
    db.from("release_year_stats").select("*").order("release_year", { ascending: false }),
    fetchTopMediaServer("movie", null, 10),
    fetchTopMediaServer("tv_series", null, 10),
  ]);

  const summary = (summaryRes && (summaryRes as any).data) || [];
  const error = (summaryRes && (summaryRes as any).error) || null;

  if (error) {
    console.error("Failed to fetch release year stats:", error);
  }

  return (
    <main>
      <HomeDashboard summary={summary as Summary[]} topMovies={topMovies ?? []} topSeries={topSeries ?? []} />
    </main>
  );
}
