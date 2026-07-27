import { supabaseServer } from "@/utils/supabase";
import HomeDashboard from "@/components/HomeDashboard";
import { Summary } from "@/lib/types/Summary";

export const revalidate = 60; 

export default async function HomePage() {
  const { data: stats } = await supabaseServer
      .from('release_year_stats')
      .select('release_year, total_movies, total_series, watched_movies, watched_series, movie_avg_rating, series_avg_rating')
      .order('release_year', { ascending: false });

  const formatItem = (item: any) => {
    return {
      release_year: item.release_year,
      total_movies: item.total_movies,
      total_series: item.total_series,
      watched_movies: item.watched_movies,
      watched_series: item.watched_series,
      movie_avg_rating: item.movie_avg_rating,
      series_avg_rating: item.series_avg_rating
    };
  };

  const summary = (stats ?? []).map(formatItem) as Summary[];

  return (
    <main>
      <HomeDashboard summary={summary} />
    </main>
  );
}