import { supabaseServer } from '@/utils/supabase'; // From the step where you setup your client
import MovieCatalog from './MovieCatalog';

export default async function MoviesPage() {
  // Fetch tracking data specifically for movies
  const { data, error } = await supabaseServer
    .from('tracking')
    .select(`
      status,
      rating,
      media_items!inner (
        id, title, summary, cover_url, release_date, type,
        media_genres ( genres ( name ) ),
        media_languages ( languages ( name ) ),
        media_credits ( people ( name ), role, credit_order )
      )
    `)
    .eq('media_items.type', 'movie');

  if (error) {
    console.error("Supabase Error:", error);
    return <div>Error loading movies.</div>;
  }

  // Format the nested Supabase JSON into a clean, flat object for the UI
  const formattedMovies = data.map((item: any) => ({
    id: item.media_items.id,
    title: item.media_items.title,
    date: item.media_items.release_date,
    rating: item.rating,
    status: item.status,
    summary: item.media_items.summary,
    cover_url: item.media_items.cover_url,
    genre: item.media_items.media_genres.map((g: any) => g.genres.name).join(' · '),
    language: item.media_items.media_languages.map((l: any) => l.languages.name).join(', '),
    cast: (item.media_items.media_credits ?? [])
      .filter((c: any) => c.role === 'actor')
      .sort((a: any, b: any) => a.credit_order - b.credit_order)
      .map((c: any) => c.people.name)
      .join(', ')
  }));

  const watchedMovies = formattedMovies.filter(m => m.status === 'watched');
  const wantMovies = formattedMovies.filter(m => m.status === 'want_to_watch' || m.status === 'upcoming');

  return (
    <MovieCatalog watched={watchedMovies} want={wantMovies} />
  );
}