import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/utils/supabase";

// --- 1. Shared Types & Data Fetchers ---
type Movie = {
  id: string;
  title: string;
  date: string;
  rating: number | null;
  genres: string[];
  languages: string[];
  regions: string[];
  series: string | null;
  status: string;
  summary: string;
  cover_url: string;
  casts: string[];
  directors: string[];
};

type SeriesMovie = {
  id: string;
  title: string;
  cover_url: string;
  date: string;
};

async function getMovie(id: string): Promise<Movie | null> {
  const queryId = /^\d+$/.test(id) ? Number(id) : id;
  const { data, error } = await supabaseServer
    .from("media_items")
    .select(`
      id, title, summary, cover_url, release_date, type,
      tracking!inner ( status, rating ),
      media_genres ( genres ( name ) ),
      media_languages ( languages ( name ) ),
      media_regions ( regions ( name ) ),
      media_credits ( people ( name ), role, credit_order ),
      media_series ( name )
    `)
    .eq("id", queryId)
    .single();

  if (error || !data) return null;
  const userTracking = data.tracking?.[0] || {};

  let seriesName = null;
  if (data.media_series) {
    seriesName = Array.isArray(data.media_series) 
      ? data.media_series[0]?.name 
      : (data.media_series as any).name;
  }

  return {
    id: String(data.id),
    title: data.title,
    date: data.release_date,
    rating: userTracking.rating ?? null,
    genres: (data.media_genres ?? []).map((g: any) => g.genres.name),
    languages: (data.media_languages ?? []).map((l: any) => l.languages.name),
    regions: (data.media_regions ?? []).map((r: any) => r.regions.name),
    series: seriesName || null,
    status: userTracking.status || "",
    summary: data.summary || "",
    cover_url: data.cover_url || "",
    casts: (data.media_credits ?? [])
      .filter((c: any) => c.role === "actor")
      .sort((a: any, b: any) => a.credit_order - b.credit_order)
      .map((c: any) => c.people.name),
    directors: (data.media_credits ?? [])
      .filter((c: any) => c.role === "director")
      .sort((a: any, b: any) => a.credit_order - b.credit_order)
      .map((c: any) => c.people.name)
  };
}

async function getSeriesMovies(seriesName: string, currentId: string): Promise<SeriesMovie[]> {
  const { data, error } = await supabaseServer
    .from("media_items")
    .select(`
      id, title, cover_url, release_date,
      media_series!inner(name)
    `)
    .eq("media_series.name", seriesName)
    .neq("id", currentId)
    .order("release_date", { ascending: true });

  if (error || !data) return [];

  return data.map((d: any) => ({
    id: String(d.id),
    title: d.title,
    cover_url: d.cover_url || "",
    date: d.release_date || "",
  }));
}

// --- 2. Reusable UI Components ---
function SearchTag({ label, category }: { label: string; category: string }) {
  return (
    <Link 
      href={`/search?${category}=${encodeURIComponent(label)}`}
      className="inline-flex items-center px-3 py-1.5 rounded-md bg-white/3 border border-white/10 text-neutral-300 text-xs font-medium tracking-wide transition-all hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-sm"
    >
      {label}
    </Link>
  );
}

function InfoCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 p-5 rounded-2xl bg-white/2 border border-white/5 ${className}`}>
      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">
        {title}
      </span>
      <div>{children}</div>
    </div>
  );
}

// --- 3. The Detail Page Component ---
export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movie = await getMovie(id);

  if (!movie) notFound();

  const seriesMovies = movie.series ? await getSeriesMovies(movie.series, movie.id) : [];

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-neutral-200 selection:bg-neutral-700 selection:text-white font-sans">
      
      {/* Subtle Top Gradient */}
      <div className="absolute top-0 inset-x-0 h-[50vh] bg-linear-to-b from-white/3 to-transparent pointer-events-none" />

      <div className="container mx-auto px-6 md:px-8 max-w-5xl pt-6 pb-16 relative z-10">
        
        {/* Navigation */}
        <Link 
          href="/movies" 
          className="group inline-flex items-center text-sm font-medium text-neutral-500 hover:text-white mb-8 transition-colors"
        >
          <span className="mr-2 group-hover:-translate-x-1 transition-transform duration-300">←</span>
          返回电影列表
        </Link>

        {/* --- TOP SECTION: Poster & Synopsis --- */}
        <div className="flex flex-col md:flex-row gap-12 lg:gap-16 mb-12">
          
          {/* Left Column: Poster & Status */}
          <div className="w-full md:w-70 shrink-0 flex flex-col gap-6">
            <div className="aspect-2/3 w-full bg-neutral-900/50 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative">
              {movie.cover_url ? (
                <img
                  src={movie.cover_url}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 gap-2">
                  <span className="text-sm">无海报</span>
                </div>
              )}
            </div>

            {movie.status === "watched" && (
              <div className="flex items-center justify-center gap-2 w-full bg-emerald-500/10 text-emerald-400/90 font-medium py-3 rounded-xl border border-emerald-500/20 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                已观看
              </div>
            )}
          </div>

          {/* Right Column: Title & Synopsis ONLY */}
          <div className="flex-1 flex flex-col pt-2">
            
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight bg-clip-text text-transparent bg-linear-to-br from-white to-neutral-400">
                {movie.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                {movie.date && (
                  <span className="text-neutral-400">
                    {movie.date.substring(0, 4)}
                  </span>
                )}
                
                {movie.rating ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>{movie.rating.toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="text-neutral-600">未评分</span>
                )}

                {movie.series && (
                  <>
                    <span className="text-neutral-700">•</span>
                    <Link 
                      href={`/search?series=${encodeURIComponent(movie.series)}`}
                      className="text-neutral-400 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/50"
                    >
                      {movie.series}
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-widest mb-4">剧情简介</h3>
              <p className="text-neutral-300 leading-relaxed text-base md:text-lg opacity-90">
                {movie.summary || "暂无简介。"}
              </p>
            </div>
          </div>
        </div>

        {/* --- BOTTOM SECTION: Full Width Metadata Grid --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-white/5 pt-10">
          
          <InfoCard title="类型">
            <div className="flex flex-wrap gap-2">
              {movie.genres?.length > 0 
                ? movie.genres.map((g) => <SearchTag key={g} label={g} category="genre" />) 
                : <span className="text-neutral-600 text-sm">-</span>}
            </div>
          </InfoCard>

          <InfoCard title="地区">
            <div className="flex flex-wrap gap-2">
              {movie.regions?.length > 0 
                ? movie.regions.map((r) => <SearchTag key={r} label={r} category="region" />)
                : <span className="text-neutral-600 text-sm">-</span>}
            </div>
          </InfoCard>

          <InfoCard title="语言">
            <div className="flex flex-wrap gap-2">
              {movie.languages?.length > 0 
                ? movie.languages.map((l) => <SearchTag key={l} label={l} category="language" />)
                : <span className="text-neutral-600 text-sm">-</span>}
            </div>
          </InfoCard>

          <InfoCard title="导演">
            <div className="flex flex-wrap gap-2">
              {movie.directors?.length > 0 
                ? movie.directors.map((d) => <SearchTag key={d} label={d} category="director" />) 
                : <span className="text-neutral-600 text-sm">-</span>}
            </div>
          </InfoCard>

          <div className={`p-5 rounded-2xl bg-white/2 border border-white/5 sm:col-span-2 lg:col-span-2'}`}>
            <span className="block text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4">
              主演
            </span>
            <div className="flex flex-wrap gap-2">
              {movie.casts?.length > 0 
                ? movie.casts.map((c) => <SearchTag key={c} label={c} category="cast" />) 
                : <span className="text-neutral-600 text-sm">-</span>}
            </div>
          </div>

        </div>

        {/* --- Related Series Row --- */}
        {movie.series && seriesMovies.length > 0 && (
          <div className="mt-20 pt-10 border-t border-white/5">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
                  《{movie.series}》系列其他作品
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
              {seriesMovies.map((sm) => (
                <Link key={sm.id} href={`/movie/${sm.id}`} className="group flex flex-col gap-3">
                  <div className="aspect-2/3 w-full bg-neutral-900/50 rounded-xl overflow-hidden ring-1 ring-white/5 group-hover:ring-white/20 transition-all shadow-lg group-hover:shadow-xl">
                    {sm.cover_url ? (
                      <img 
                        src={sm.cover_url} 
                        alt={sm.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        loading="lazy" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 gap-1 bg-neutral-800/20">
                        <span className="text-xs">无海报</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-200 truncate group-hover:text-white transition-colors">
                      {sm.title}
                    </h4>
                    {sm.date && (
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {sm.date.substring(0, 4)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}