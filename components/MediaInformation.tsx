import Image from "next/image";
import Link from "next/link";
import { Media } from "@/lib/types";
import MediaRow from "./MediaRow";
import SearchTag from "./SearchTag";

export function CinematicBackground({ imageUrl }: { imageUrl: string }) {
  if (!imageUrl) return null;
  
  return (
    <div 
      // 1. z-0 puts it in the correct layer (behind content, but above the root black background)
      // 2. mix-blend-screen ensures dark poster pixels become invisible, letting your red glows shine through!
      className="absolute top-0 inset-x-0 h-[75vh] pointer-events-none z-0 mix-blend-screen select-none"
      style={{ 
        maskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)', 
        WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)' 
      }}
    >
      <Image 
        src={imageUrl} 
        alt="cinematic background" 
        fill 
        // Opacity at 30% combined with mix-blend-screen creates a perfect ambient glow
        className="object-cover opacity-20 blur-[80px] saturate-150 scale-125" 
        priority
      />
    </div>
  );
}

function MediaPoster({ media }: { media: Media }) {
  return (
    <div className="w-full md:w-72 shrink-0 flex flex-col gap-6">
      {/* Frosted Glass Back Button */}
      <Link href="/movies" className="group inline-flex items-center text-sm font-medium text-white/70 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all w-fit bg-white/5 backdrop-blur-2xl px-4 py-2 rounded-xl border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:border-white/20 hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
        <span className="mr-2 group-hover:-translate-x-1 transition-transform duration-300">←</span>
        返回列表
      </Link>

      {/* Lighter Frosted Glass Poster */}
      <div className="aspect-2/3 w-full bg-white/5 backdrop-blur-2xl rounded-xl overflow-hidden border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.3)] relative">
        {media.cover_url ? (
          <Image src={media.cover_url} alt={media.title} fill sizes="(max-width: 768px) 100vw, 288px" className="object-cover transition-transform duration-700 hover:scale-105" priority/>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/30 gap-2">
            <i className="fas fa-image text-4xl drop-shadow-md"></i>
            <span className="text-sm">暂无海报</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ isWatched }: { isWatched: boolean }) {
  if (isWatched) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold backdrop-blur-2xl shadow-[0_4px_10px_rgba(16,185,129,0.2)] drop-shadow-[0_0_5px_rgba(16,185,129,0.4)] cursor-default transition-all">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        已观看
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-white/60 border border-white/10 text-xs font-medium backdrop-blur-2xl shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] transition-all cursor-pointer">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
        未观看
      </div>
    );
  }
}

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-8 py-3 border-b border-white/10 last:border-0 transition-colors hover:bg-white/5 rounded-xl px-3 -mx-3 items-center group">
      <span className="text-base font-medium text-white/50 w-16 shrink-0 sm:pt-1 tracking-widest group-hover:text-white/70 transition-colors">
        {label}
      </span>
      <div className="flex flex-wrap gap-2.5 flex-1">
        {children}
      </div>
    </div>
  );
}

export function MediaMetadata({ media }: { media: Media }) {
  return (
    <div className="flex flex-col">
      <MetadataRow label="类型">
        {media.genres?.length > 0 
          ? media.genres.map((g) => <SearchTag key={g} label={g} category="genre" />) 
          : <span className="text-white/30 text-sm sm:pt-1">-</span>}
      </MetadataRow>
        
      <MetadataRow label="地区">
        {media.regions && media.regions.length > 0 
          ? media.regions.map((r) => <SearchTag key={r} label={r} category="region" />)
          : <span className="text-white/30 text-sm sm:pt-1">-</span>}
      </MetadataRow>

      <MetadataRow label="语言">
        {media.languages?.length > 0 
          ? media.languages.map((l) => <SearchTag key={l} label={l} category="language" />)
          : <span className="text-white/30 text-sm sm:pt-1">-</span>}
      </MetadataRow>

      <MetadataRow label="导演">
        {media.directors && media.directors.length > 0 
          ? media.directors.map((d) => <SearchTag key={d} label={d} category="director" />) 
          : <span className="text-white/30 text-sm sm:pt-1">-</span>}
      </MetadataRow>

      <MetadataRow label="主演">
        {media.casts && media.casts.length > 0 
          ? media.casts.map((c) => <SearchTag key={c} label={c} category="cast" />) 
          : <span className="text-white/30 text-sm sm:pt-1">-</span>}
      </MetadataRow>
    </div>
  );
}

type SeasonInfo = {
  id: number;
  name: string;
  year: number;
  episodeCount: number;
};

export default function MediaInformation({
  media,
  relatedMedia,
  seasons,
}: {
  media: Media;
  relatedMedia: Media[] | null;
  seasons: SeasonInfo[] | null;
}) {
  return (
    <>
      <CinematicBackground imageUrl={media.cover_url} />

      <div className="container mx-auto px-6 md:px-8 max-w-7xl pt-24 pb-12 relative z-10">
        <div className="flex flex-col md:flex-row gap-12 lg:gap-20">
          <MediaPoster media={media} />

          <div className="flex-1 flex flex-col pt-4 md:pt-8">
            <div className="mb-4 md:mb-8">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mt-4 mb-6 text-white text-balance drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                {media.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                {media.date && (
                  <span className="text-white/80 bg-white/5 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.2)] px-3 py-1.5 rounded-md backdrop-blur-2xl">
                    {media.date.substring(0, 4)}
                  </span>
                )}

                {media.rating ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 backdrop-blur-2xl shadow-[0_4px_10px_rgba(251,191,36,0.2)] drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="font-bold tracking-wide">{media.rating.toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="text-white/50 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 backdrop-blur-2xl">
                    未评分
                  </span>
                )}

                {media.runtime && (
                  <>
                    <span className="text-white/20 hidden sm:inline">•</span>
                    <Link href={`/search?runtime=${encodeURIComponent(media.runtime.toString())}`} className="text-white/60 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/80 drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                      {media.runtime} 分钟
                    </Link>
                  </>
                )}

                <div className="md:ml-auto md:order-last">
                  <StatusBadge isWatched={media.status === "watched"} />
                </div>
              </div>
            </div>

            <MediaMetadata media={media} />
          </div>
        </div>

        <div className="mb-12 mt-12 bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-red-400 rounded-sm shadow-[0_0_8px_rgba(248,113,113,0.6)]"></div> 
            <h3 className="text-white/90 font-bold text-lg drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] tracking-widest">
              剧情简介
            </h3>
          </div>
          <p className="text-white/70 leading-loose tracking-wide text-base text-left wrap-break-word">
            {media.summary || "暂无简介。"}
          </p>
        </div>
      
      {seasons && (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 bg-red-400 rounded-sm shadow-[0_0_8px_rgba(248,113,113,0.6)]"></div> 
            <h3 className="text-white/90 font-bold text-lg drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] tracking-widest">
              剧集列表
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {seasons.map((season) => (
              <button
                key={season.id}
                className="group flex flex-col text-left bg-white/5 backdrop-blur-2xl border border-white/10 rounded-xl p-5 cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:border-red-400/40 hover:bg-white/10 hover:-translate-y-1.5 hover:shadow-[0_15px_40px_rgba(248,113,113,0.2)] transition-all duration-300"
              >
                <h4 className="text-white/80 font-bold text-base mb-2 group-hover:text-red-300 group-hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)] transition-colors">
                  {season.name}
                </h4>
                <div className="flex items-center text-xs text-white/50 space-x-2 mt-auto font-mono">
                  <span>{season.year}</span>
                  <span>•</span>
                  <span>{season.episodeCount} 集</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
        
        {media.series && (
          <div className="space-y-12">
            <MediaRow
              title={"《" + media.series + "》系列其他电影"}
              items={relatedMedia || []}
              viewAllLink="/movies/watched"
              type={media.type ?? "movies"}
            />
          </div>
        )}
      </div>
    </>
  );
}