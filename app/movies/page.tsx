import { supabaseServer } from '@/utils/supabase';
import MoviesCatalog from './MoviesCatalog';
import { Media } from '@/lib/types/Media';

export const revalidate = 60;

export default async function MoviesPage() {
  {/* 获取电影统计数据 */}
  const totalCountRes = await supabaseServer
    .from('media_items')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'movie');

  const watchedCountRes = await supabaseServer
    .from('media_items')
    .select('id, tracking!inner(status)', { count: 'exact', head: true })
    .eq('type', 'movie')
    .eq('tracking.status', 'watched');

  const wantCountRes = await supabaseServer
    .from('media_items')
    .select('id, tracking!inner(status)', { count: 'exact', head: true })
    .eq('type', 'movie')
    .eq('tracking.status', 'want_to_watch');

  const today = new Date().toISOString().split('T')[0];
  const upcomingCountRes = await supabaseServer
    .from('media_items')
    .select('id, tracking!inner(status)', { count: 'exact', head: true })
    .eq('type', 'movie')
    .eq('tracking.status', 'want_to_watch')
    .gte('release_date', today);

  const totalCount = totalCountRes.count ?? 0;
  const watchedCount = watchedCountRes.count ?? 0;
  const wantCount = wantCountRes.count ?? 0;
  const upcomingCount = upcomingCountRes.count ?? 0;

  {/* 获取已观看和想看的电影数据 */}
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

  {/* 格式化电影数据为 Media 类型 */}
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

  const watchedMovies = (watchedData ?? []).map(formatItem) as Media[];
  const wantMovies = (wantData ?? []).map(formatItem) as Media[];

  {/* 渲染 MoviesCatalog 组件并传入数据 */}
  return (
    <MoviesCatalog 
      watched={watchedMovies} 
      want={wantMovies}
      stats={{ total: totalCount, watched: watchedCount, want: wantCount, upcoming: upcomingCount }}
    />
  );
}