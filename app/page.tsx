import { supabaseServer } from "@/utils/supabase";
import HomeDashboard from "@/app/HomeDashboard";
import { Summary } from "@/lib/types/Summary";
import { Media } from "@/lib/types/Media";

export const revalidate = 60; 

export default async function HomePage() {
  const { data: stats } = await supabaseServer
      .from('release_year_stats')
      .select('release_year, total_movies, total_series, watched_movies, watched_series, movie_avg_rating, series_avg_rating')
      .order('release_year', { ascending: false });

  const formatStats = (item: any) => {
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

  const summary = (stats ?? []).map(formatStats) as Summary[];

  const { data: topMoviesData } = await supabaseServer
    .from('media_items')
    .select(`
      id, title, summary, cover_url, release_date, type,
      tracking!inner ( status, rating ),
      media_genres ( genres ( name ) ),
      media_languages ( languages ( name ) ),
      media_regions ( regions ( name ) ),
      media_credits ( people ( name ), role, credit_order ),
      media_series ( name )
    `)
    .eq('type', 'movie')
    .eq('tracking.status', 'watched')
    .order('tracking(rating)', { ascending: false })
    .limit(10);

  const formatItem = (item: any) => {
      const userTracking = item.tracking?.[0] || {};
  
      return {
        id: item.id,
        title: item.title,
        date: item.release_date,
        rating: userTracking.rating,
        status: userTracking.status,
        summary: item.summary,
        cover_url: item.cover_url,
        genres: (item.media_genres ?? []).map((g: any) => g.genres.name),
        languages: (item.media_languages ?? []).map((l: any) => l.languages.name),
        regions: (item.media_regions ?? []).map((r: any) => r.regions.name),
        series: item.media_series?.name || null,
        casts: (item.media_credits ?? [])
          .filter((c: any) => c.role === 'actor')
          .sort((a: any, b: any) => a.credit_order - b.credit_order)
          .map((c: any) => c.people.name)
      };
    };
  
    const topMovies = (topMoviesData ?? []).map(formatItem) as Media[];

  return (
    <main>
      <HomeDashboard summary={summary} topMovies={topMovies} />
    </main>
  );
}