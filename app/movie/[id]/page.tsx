import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { supabaseServer } from "@/utils/supabase";
import ItemCard from "@/components/ItemCard";

// --- 1. 类型定义优化 (移除 any) ---
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

type DbGenre = { genres: { name: string } };
type DbLanguage = { languages: { name: string } };
type DbRegion = { regions: { name: string } };
type DbCredit = { people: { name: string }; role: string; credit_order: number };
type DbSeries = { name: string };

// --- 2. 数据获取层 ---
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
  
  const userTracking = Array.isArray(data.tracking) ? data.tracking[0] : data.tracking;

  let seriesName = null;
  if (data.media_series) {
    seriesName = Array.isArray(data.media_series) 
      ? data.media_series[0]?.name 
      : (data.media_series as DbSeries).name;
  }

  const credits = (data.media_credits as unknown as DbCredit[] | null) ?? [];

  return {
    id: String(data.id),
    title: data.title,
    date: data.release_date,
    rating: userTracking?.rating ?? null,
    genres: ((data.media_genres as unknown as DbGenre[] | null) ?? []).map((g) => g.genres.name),
    languages: ((data.media_languages as unknown as DbLanguage[] | null) ?? []).map((l) => l.languages.name),
    regions: ((data.media_regions as unknown as DbRegion[] | null) ?? []).map((r) => r.regions.name),
    series: seriesName || null,
    status: userTracking?.status || "",
    summary: data.summary || "",
    cover_url: data.cover_url || "",
    casts: credits
      .filter((c) => c.role === "actor")
      .sort((a, b) => a.credit_order - b.credit_order)
      .map((c) => c.people.name),
    directors: credits
      .filter((c) => c.role === "director")
      .sort((a, b) => a.credit_order - b.credit_order)
      .map((c) => c.people.name)
  };
}

// --- 3. 颗粒化 UI 组件 ---

function SearchTag({ label, category }: { label: string; category: string }) {
  return (
    <Link 
      href={`/search?${category}=${encodeURIComponent(label)}`}
      className="inline-flex items-center px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-neutral-300 text-xs font-medium tracking-wide transition-all hover:bg-white/15 hover:text-white hover:border-white/30 hover:shadow-sm"
    >
      {label}
    </Link>
  );
}

function InfoCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm transition-colors hover:bg-white/10 ${className}`}>
      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
        {title}
      </span>
      <div>{children}</div>
    </div>
  );
}

function CinematicBackground({ imageUrl }: { imageUrl: string }) {
  if (!imageUrl) return <div className="absolute top-0 inset-x-0 h-[50vh] bg-gradient-to-b from-white/5 to-transparent pointer-events-none -z-10" />;
  
  return (
    <div className="absolute top-0 inset-x-0 h-[70vh] overflow-hidden pointer-events-none -z-10">
      <Image 
        src={imageUrl} 
        alt="background blur"
        fill
        className="object-cover opacity-20 blur-[80px] saturate-150 scale-110"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/80 to-[#0a0a0a]" />
    </div>
  );
}

function MoviePoster({ movie }: { movie: Movie }) {
  return (
    <div className="w-full md:w-72 shrink-0 flex flex-col gap-6">
      <Link 
        href="/movies" 
        className="group inline-flex items-center text-sm font-medium text-neutral-400 hover:text-white transition-colors w-fit"
      >
        <span className="mr-2 group-hover:-translate-x-1 transition-transform duration-300">←</span>
        返回电影列表
      </Link>

      <div className="aspect-[2/3] w-full bg-neutral-900/80 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.8)] relative">
        {movie.cover_url ? (
          <Image
            src={movie.cover_url}
            alt={movie.title}
            fill
            sizes="(max-width: 768px) 100vw, 288px"
            className="object-cover transition-transform duration-700 hover:scale-105"
            priority
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 gap-2">
            <span className="text-sm">暂无海报</span>
          </div>
        )}
      </div>

      {movie.status === "watched" && (
        <div className="flex items-center justify-center gap-2 w-full bg-emerald-500/10 text-emerald-400 font-medium py-3 rounded-xl border border-emerald-500/20 text-sm backdrop-blur-md">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          已观看
        </div>
      )}
    </div>
  );
}

function MovieMetadata({ movie }: { movie: Movie }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-white/10 pt-10 mt-10">
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

      <InfoCard title="主演" className="sm:col-span-2 lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {movie.casts?.length > 0 
            ? movie.casts.map((c) => <SearchTag key={c} label={c} category="cast" />) 
            : <span className="text-neutral-600 text-sm">-</span>}
        </div>
      </InfoCard>
    </div>
  );
}

// 独立的服务端组件，负责拉取并渲染系列数据
async function RelatedSeries({ seriesName, currentId }: { seriesName: string, currentId: string }) {
  const { data, error } = await supabaseServer
    .from("media_items")
    .select(`
      id, title, cover_url, release_date,
      tracking ( rating ),
      media_genres ( genres ( name ) ),
      media_languages ( languages ( name ) ),
      media_series!inner(name)
    `)
    .eq("media_series.name", seriesName)
    .neq("id", currentId)
    .order("release_date", { ascending: true });

  if (error || !data || data.length === 0) return null;

  const seriesMovies = data.map((d) => ({
    id: String(d.id),
    title: d.title,
    cover_url: d.cover_url || "",
    date: d.release_date || "",
    rating: Array.isArray(d.tracking) ? d.tracking[0]?.rating ?? null : null,
    genres: ((d.media_genres as unknown as DbGenre[] | null) ?? []).map((g) => g.genres.name),
    languages: ((d.media_languages as unknown as DbLanguage[] | null) ?? []).map((l) => l.languages.name),
  }));

  return (
    <div className="mt-20 pt-10 border-t border-white/10 relative">
      <h2 className="text-2xl font-bold tracking-tight text-white mb-6">
        《{seriesName}》系列其他作品
      </h2>
      
      {/* 侧边渐变遮罩，提示可滑动 */}
      <div className="absolute right-0 top-[80px] bottom-0 w-16 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none z-10" />

      <div className="flex space-x-4 overflow-x-auto no-scrollbar py-4 px-1 snap-x snap-mandatory">
        {seriesMovies.map((sm) => (
          <Link 
            key={sm.id} 
            href={`/movie/${sm.id}`} 
            className="flex-none w-44 cursor-pointer flex flex-col snap-start bg-neutral-900 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-white/30 hover:shadow-xl hover:shadow-white/5"
          >
            <ItemCard item={sm} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// --- 4. 页面主组件 (极简结构) ---
export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movie = await getMovie(id);

  if (!movie) notFound();

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-neutral-200 selection:bg-neutral-700 selection:text-white font-sans overflow-hidden">
      
      <CinematicBackground imageUrl={movie.cover_url} />

      <div className="container mx-auto px-6 md:px-8 max-w-7xl pt-10 pb-24 relative z-10">
        <div className="flex flex-col md:flex-row gap-12 lg:gap-16">
          <MoviePoster movie={movie} />

          <div className="flex-1 flex flex-col pt-1">
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-neutral-500">
                {movie.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                {movie.date && (
                  <span className="text-neutral-400">
                    {movie.date.substring(0, 4)}
                  </span>
                )}
                
                {movie.rating ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 backdrop-blur-md">
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
                      className="text-neutral-300 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/60"
                    >
                      {movie.series}
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">剧情简介</h3>
              <p className="text-neutral-300/90 leading-relaxed tracking-wide text-base max-w-5xl text-justify break-words">
                {movie.summary || "暂无简介。"}
              </p>
            </div>
          </div>
        </div>

        <MovieMetadata movie={movie} />

        {/* 使用 Suspense 隔离加载状态，不阻塞主页面的首屏渲染 */}
        {movie.series && (
          <Suspense fallback={<div className="h-48 mt-20 flex items-center justify-center text-neutral-600">正在加载系列作品...</div>}>
            <RelatedSeries seriesName={movie.series} currentId={movie.id} />
          </Suspense>
        )}
        
      </div>
    </div>
  );
}