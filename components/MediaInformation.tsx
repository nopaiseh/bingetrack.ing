import Image from "next/image";
import Link from "next/link";
import { Media } from "@/lib/types/Media";
import MediaRow from "./MediaRow";
import SearchTag from "./SearchTag";

export function CinematicBackground({ imageUrl }: { imageUrl: string }) {
  if (!imageUrl) 
    return <div className="absolute top-0 inset-x-0 h-[50vh] bg-linear-to-b from-white/5 to-transparent pointer-events-none z-0" />;
  
  return (
    <div className="absolute top-0 inset-x-0 h-[70vh] overflow-hidden pointer-events-none z-0">
      <Image src={imageUrl} alt="cinematic background" fill className="object-cover opacity-20 blur-[80px] saturate-150 scale-110" priority/>
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#060606]/80 to-[#060606]" />
    </div>
  );
}

function MediaPoster({ media }: { media: Media }) {
  return (
    <div className="w-full md:w-72 shrink-0 flex flex-col gap-6">
      <Link href="/movies" className="group inline-flex items-center text-sm font-medium text-neutral-400 hover:text-white transition-colors w-fit">
        <span className="mr-2 group-hover:-translate-x-1 transition-transform duration-300">←</span>
        返回列表
      </Link>

      <div className="aspect-2/3 w-full bg-neutral-900/80 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.8)] relative">
        {media.cover_url ? (
          <Image src={media.cover_url} alt={media.title} fill sizes="(max-width: 768px) 100vw, 288px" className="object-cover transition-transform duration-700 hover:scale-105" priority/>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 gap-2">
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
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.1)] cursor-pointer">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        已观看
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/3 text-neutral-500 border border-white/8 text-xs font-medium backdrop-blur-md hover:bg-white/8 hover:text-neutral-200 transition-all cursor-pointer">
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
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-8 py-2 border-b border-white/3 last:border-0 transition-colors hover:bg-white/1 items-center">
      <span className="text-base font-medium text-neutral-500 w-16 shrink-0 sm:pt-1 tracking-widest">
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
          : <span className="text-neutral-600 text-sm sm:pt-1">-</span>}
      </MetadataRow>
        
      <MetadataRow label="地区">
        {media.regions && media.regions.length > 0 
          ? media.regions.map((r) => <SearchTag key={r} label={r} category="region" />)
          : <span className="text-neutral-600 text-sm sm:pt-1">-</span>}
      </MetadataRow>

      <MetadataRow label="语言">
        {media.languages?.length > 0 
          ? media.languages.map((l) => <SearchTag key={l} label={l} category="language" />)
          : <span className="text-neutral-600 text-sm sm:pt-1">-</span>}
      </MetadataRow>

      <MetadataRow label="导演">
        {media.directors && media.directors.length > 0 
          ? media.directors.map((d) => <SearchTag key={d} label={d} category="director" />) 
          : <span className="text-neutral-600 text-sm sm:pt-1">-</span>}
      </MetadataRow>

      <MetadataRow label="主演">
        {media.casts && media.casts.length > 0 
          ? media.casts.map((c) => <SearchTag key={c} label={c} category="cast" />) 
          : <span className="text-neutral-600 text-sm sm:pt-1">-</span>}
      </MetadataRow>
    </div>
  );
}

export default function MediaInformation({
  media,
  relatedMedia,
}: {
  media: Media;
  relatedMedia: Media[] | null;
}) {
  return (
    <>
      <CinematicBackground imageUrl={media.cover_url} />

      <div className="container mx-auto px-6 md:px-8 max-w-7xl pt-24 pb-12 relative z-10">
        <div className="flex flex-col md:flex-row gap-12 lg:gap-20">
          <MediaPoster media={media} />

          {/* 右侧信息区，包括标题和元数据 */}
          <div className="flex-1 flex flex-col pt-4 md:pt-8">
            <div className="mb-4 md:mb-6">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-4 mb-6 text-white text-balance">
                {media.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                {media.date && (
                  <span className="text-neutral-300 bg-white/10 px-3 py-1 rounded-md backdrop-blur-sm">
                    {media.date.substring(0, 4)}
                  </span>
                )}

                {media.rating ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 backdrop-blur-md">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="font-bold">{media.rating.toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="text-neutral-500 px-3 py-1 rounded-md bg-white/5">
                    未评分
                  </span>
                )}

                {media.runtime && (
                  <>
                    <span className="text-neutral-700 hidden sm:inline">•</span>
                    <Link href={`/search?runtime=${encodeURIComponent(media.runtime.toString())}`} className="text-neutral-400 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/80">
                      {media.runtime} 分钟
                    </Link>
                  </>
                )}

                <div className="md:ml-auto md:order-last">
                  <StatusBadge isWatched={media.status === "watched"} />
                </div>
              </div>
            </div>

            {/* 元数据区，包括类型、地区、语言、导演和主演 */}
            <MediaMetadata media={media} />
          </div>
        </div>

        {/* 剧情简介展示区 */}
        <div className="mb-12 mt-12">
          <h3 className="text-md font-semibold text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-white/20 rounded-full"></span>
            剧情简介
          </h3>
          <p className="text-neutral-300/80 leading-loose tracking-wide text-base text-left wrap-break-word">
            {media.summary || "暂无简介。"}
          </p>
        </div>

        {/* 系列作品展示区 */}
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
