import { supabaseServer } from '@/utils/supabase';
import MovieCatalog from './MovieCatalog';

export default async function MoviesPage() {
  // ─── STATS (COUNT) ──────────────────────────────────
  const totalCountRes = await supabaseServer.from('tracking').select('*', { count: 'exact', head: true });
  const watchedCountRes = await supabaseServer.from('tracking').select('*', { count: 'exact', head: true }).eq('status', 'watched');
  const wantCountRes = await supabaseServer.from('tracking').select('*', { count: 'exact', head: true }).eq('status', 'want_to_watch');

  const today = new Date().toISOString().split('T')[0];

  const upcomingCountRes = await supabaseServer
    .from('tracking')
    .select('media_item_id, media_items!inner(id, type, release_date)', { count: 'exact', head: true })
    .eq('media_items.type', 'movie')
    .gte('media_items.release_date', today);

  const totalTracked = totalCountRes.count ?? 0;
  const watchedCount = watchedCountRes.count ?? 0;
  const wantCount = wantCountRes.count ?? 0;
  const upcomingCount = upcomingCountRes.count ?? 0;

  // ─── WATCHED MOVIES (LIMIT 10) ──────────────────────
  const { data: watchedData } = await supabaseServer
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
    .order('release_date', { ascending: false })
    .limit(10);

  // ─── WANT TO WATCH MOVIES (LIMIT 10) ────────────
  const { data: wantData } = await supabaseServer
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
    .eq('tracking.status', 'want_to_watch')
    .order('release_date', { ascending: false })
    .limit(10);

  // ─── FORMAT DATA ────────────────────────────────────
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

  const watchedMovies = (watchedData ?? []).map(formatItem);
  const wantMovies = (wantData ?? []).map(formatItem);

  return (
    <MovieCatalog 
      watched={watchedMovies} 
      want={wantMovies}
      stats={{ total: totalTracked, watched: watchedCount, want: wantCount, upcoming: upcomingCount }}
    />
  );
}