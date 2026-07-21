import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/utils/supabase";

// --- 1. Shared Types & Data Fetcher ---
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
};

async function getMovie(id: string): Promise<Movie | null> {
  const queryId = /^\d+$/.test(id) ? Number(id) : id;

  const { data, error } = await supabaseServer
    .from("media_items")
    .select(`
      id,
      title,
      summary,
      cover_url,
      release_date,
      type,
      tracking!inner ( status, rating ),
      media_genres ( genres ( name ) ),
      media_languages ( languages ( name ) ),
      media_regions ( regions ( name ) ),
      media_credits ( people ( name ), role, credit_order ),
      media_series ( name )
    `)
    .eq("id", queryId)
    .single();

  if (error || !data) {
    return null;
  }

  const userTracking = data.tracking?.[0] || {};

  return {
    id: String(data.id),
    title: data.title,
    date: data.release_date,
    rating: userTracking.rating ?? null,
    genres: (data.media_genres ?? []).map((g: any) => g.genres.name),
    languages: (data.media_languages ?? []).map((l: any) => l.languages.name),
    regions: (data.media_regions ?? []).map((r: any) => r.regions.name),
    series: (data.media_series ?? [])[0]?.name || null,
    status: userTracking.status || "",
    summary: data.summary || "",
    cover_url: data.cover_url || "",
    casts: (data.media_credits ?? [])
      .filter((c: any) => c.role === "actor")
      .sort((a: any, b: any) => a.credit_order - b.credit_order)
      .map((c: any) => c.people.name),
  };
}

// --- 2. Reusable Tag Component ---
function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block bg-neutral-800 text-neutral-300 text-xs font-medium px-2.5 py-1 rounded-md border border-neutral-700">
      {label}
    </span>
  );
}

// --- 3. The Detail Page Component ---
export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movie = await getMovie(id);

  if (!movie) {
    notFound(); // Renders the Next.js 404 page if movie isn't found
  }

  return (
    <div className="min-h-screen bg-[#101010] text-neutral-200 selection:bg-neutral-700">
      <div className="container mx-auto px-6 md:px-8 max-w-6xl py-12">
        
        {/* Breadcrumb / Back Navigation */}
        <Link 
          href="/" 
          className="group inline-flex items-center text-sm text-neutral-400 hover:text-white mb-10 transition-colors"
        >
          <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
          返回目录 (Back to Catalog)
        </Link>

        {/* Main Layout Grid */}
        <div className="flex flex-col md:flex-row gap-10 lg:gap-16">
          
          {/* Left Column: Poster & Quick Actions */}
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0 flex flex-col gap-6">
            <div className="aspect-[2/3] w-full bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-2xl relative">
              {movie.cover_url ? (
                <img
                  src={movie.cover_url}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-700">
                  无海报 (No Poster)
                </div>
              )}
            </div>

            {/* Action Buttons Container */}
            <div className="flex flex-col gap-3">
              <button className="w-full bg-white text-black font-semibold py-2.5 rounded-lg hover:bg-neutral-200 transition-colors">
                <i className="fas fa-check mr-2"></i> 已观看 (Watched)
              </button>
              <button className="w-full bg-neutral-800 text-white font-medium py-2.5 rounded-lg border border-neutral-700 hover:bg-neutral-700 transition-colors">
                编辑信息 (Edit)
              </button>
            </div>
          </div>

          {/* Right Column: Details & Metadata */}
          <div className="flex-1 flex flex-col">
            
            {/* Header Area */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4 leading-tight">
                {movie.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-neutral-400 text-sm md:text-base">
                <span className="font-medium text-white px-2 py-0.5 bg-neutral-800 rounded border border-neutral-700">
                  {movie.date.substring(0, 4)} {/* Extract Year */}
                </span>
                <div className="flex items-center gap-1.5 text-yellow-500">
                  <i className="fas fa-star text-sm"></i>
                  <span className="font-semibold text-white">
                    {movie.rating ? movie.rating.toFixed(1) : "未评分"}
                  </span>
                </div>
                {movie.series && (
                  <>
                    <span className="text-neutral-600">•</span>
                    <span>{movie.series}</span>
                  </>
                )}
              </div>
            </div>

            {/* Synopsis */}
            <div className="mb-10">
              <h3 className="text-lg font-medium text-white mb-3">剧情简介 (Synopsis)</h3>
              <p className="text-neutral-300 leading-relaxed text-base md:text-lg">
                {movie.summary || "暂无简介 (No summary available)."}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 py-6 border-t border-neutral-800">
              
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-500 uppercase tracking-wider">类型 (Genres)</span>
                <div className="flex flex-wrap gap-2">
                  {movie.genres?.length > 0 ? movie.genres.map((g) => <Tag key={g} label={g} />) : <span className="text-neutral-600 text-sm">-</span>}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-500 uppercase tracking-wider">主演 (Cast)</span>
                <div className="flex flex-wrap gap-2">
                  {movie.casts?.length > 0 ? movie.casts.map((c) => <Tag key={c} label={c} />) : <span className="text-neutral-600 text-sm">-</span>}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-500 uppercase tracking-wider">语言 (Languages)</span>
                <div className="flex flex-wrap gap-2">
                  {movie.languages?.length > 0 ? movie.languages.map((l) => <Tag key={l} label={l} />) : <span className="text-neutral-600 text-sm">-</span>}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-500 uppercase tracking-wider">地区 (Regions)</span>
                <div className="flex flex-wrap gap-2">
                  {movie.regions?.length > 0 ? movie.regions.map((r) => <Tag key={r} label={r} />) : <span className="text-neutral-600 text-sm">-</span>}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}