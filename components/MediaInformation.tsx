import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import MediaBackLink, { DefaultMediaBackLink } from "./MediaBackLink";
import { Media, SeasonInfo } from "@/lib/types";
import SearchTag from "./SearchTag";

function MediaPoster({ media }: { media: Media }) {
  return (
    <div className="w-full max-w-80 shrink-0 self-center lg:w-80 lg:self-start">
      {/* Lighter Frosted Glass Poster */}
      <div className="surface-muted relative aspect-2/3 w-full overflow-hidden rounded-xl border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        {media.cover_url ? (
          <Image src={media.cover_url} alt={media.title} fill sizes="(max-width: 393px) calc(100vw - 74px), 320px" className="object-cover transition-transform duration-700 hover:scale-105" preload/>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-2">
            <ImageIcon className="size-10 drop-shadow-md" aria-hidden="true" />
            <span className="text-sm">暂无海报</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "watched") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold backdrop-blur-2xl shadow-[0_4px_10px_rgba(16,185,129,0.2)] drop-shadow-[0_0_5px_rgba(16,185,129,0.4)] cursor-default transition-all">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        已观看
      </div>
    );
  }

  if (status === "watching") {
    return (
      <div className="flex cursor-default items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/15 px-3 py-1.5 text-xs font-bold text-sky-300 shadow-[0_4px_10px_rgba(56,189,248,0.18)] backdrop-blur-2xl">
        <span className="size-2 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.8)]" />
        正在看
      </div>
    );
  }

  return (
    <div className="surface-muted interactive-control flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 shadow-[0_4px_10px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
      </svg>
      想要看
    </div>
  );
}

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group -mx-3 flex flex-col items-start gap-3 rounded-xl border-b border-white/10 px-3 py-3 transition-colors last:border-0 hover:bg-white/5 sm:flex-row sm:gap-6">
      <span className="text-base font-medium text-white/50 w-16 shrink-0 sm:pt-1 tracking-widest group-hover:text-white/70 transition-colors">
        {label}
      </span>
      <div className="flex flex-wrap gap-2.5 flex-1">
        {children}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-5 w-1 rounded-sm bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
      <h2 className="text-sm font-bold tracking-widest text-white/90">{children}</h2>
    </div>
  );
}

export function MediaMetadata({ media, includePeople = true, releaseDateLabel }: { media: Media; includePeople?: boolean; releaseDateLabel?: string }) {
  return (
    <div className="flex flex-col">
      {releaseDateLabel !== undefined && (
        <MetadataRow label="上映">
          {releaseDateLabel
            ? <span className="surface-subtle inline-flex items-center rounded-lg border border-white/8 px-3.5 py-1.5 text-sm font-medium tracking-wide text-neutral-300">{releaseDateLabel}</span>
            : <span className="text-sm text-white/30 sm:pt-1">-</span>}
        </MetadataRow>
      )}
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

      {media.series && media.series.length > 0 && (
        <MetadataRow label="系列">
          {media.series.map((seriesName) => (
            <SearchTag key={seriesName} label={seriesName} category="series" />
          ))}
        </MetadataRow>
      )}

      {includePeople && <MediaCredits media={media} />}
    </div>
  );
}

function MediaCredits({ media }: { media: Media }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionHeading>导演</SectionHeading>
        <div className="flex flex-wrap gap-2.5">
          {media.directors && media.directors.length > 0
            ? media.directors.map((director) => <SearchTag key={director} label={director} category="director" />)
            : <span className="text-sm text-white/30">-</span>}
        </div>
      </div>
      <div>
        <SectionHeading>主演</SectionHeading>
        <div className="flex flex-wrap gap-2.5">
          {media.casts && media.casts.length > 0
            ? media.casts.map((castMember) => <SearchTag key={castMember} label={castMember} category="cast" />)
            : <span className="text-sm text-white/30">-</span>}
        </div>
      </div>
    </div>
  );
}

export default function MediaInformation({
  media,
  seasons,
  relatedContent,
  releaseDateLabel,
  displayStatus,
}: {
  media: Media;
  seasons: SeasonInfo[] | null;
  relatedContent?: ReactNode;
  releaseDateLabel?: string;
  displayStatus?: string;
}) {

  return (
    <>

      <div className="container relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-24 sm:px-6 lg:px-8">
        <Suspense fallback={<DefaultMediaBackLink type={media.type === "series" ? "series" : "movies"} />}>
          <MediaBackLink type={media.type === "series" ? "series" : "movies"} />
        </Suspense>

        <div className="surface-panel rounded-3xl p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
            <MediaPoster media={media} />

            <div className="flex flex-1 flex-col">
            <div className="mb-4 md:mb-8">
              <div className="mb-6 mt-4">
                <h1 className="text-balance text-3xl font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] sm:text-4xl lg:text-5xl">
                  {media.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                {media.rating ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 backdrop-blur-2xl shadow-[0_4px_10px_rgba(251,191,36,0.2)] drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="font-bold tracking-wide">{media.rating.toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="surface-muted rounded-md border border-white/10 px-3 py-1.5 text-white/50 backdrop-blur-2xl">
                    未评分
                  </span>
                )}

                {media.runtime && (
                  <>
                    <span className="text-white/20 hidden sm:inline">•</span>
                    <span className="text-white/60 drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                      {media.runtime} 分钟
                    </span>
                  </>
                )}

                <div className="md:ml-auto md:order-last">
                  <StatusBadge status={displayStatus ?? media.status} />
                </div>
              </div>
            </div>

              <MediaMetadata media={media} includePeople={false} releaseDateLabel={releaseDateLabel} />
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="mb-6">
              <MediaCredits media={media} />
            </div>
            <div className="border-t border-white/10 pt-6">
              <SectionHeading>剧情简介</SectionHeading>
              <p className="text-left text-sm leading-7 tracking-wide text-white/70 wrap-break-word md:text-base">
                {media.summary || "暂无简介。"}
              </p>
            </div>
          </div>
        </div>
      
      {seasons && (
        <div className="mb-12 mt-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 bg-red-400 rounded-sm shadow-[0_0_8px_rgba(248,113,113,0.6)]"></div> 
            <h3 className="text-white/90 font-bold text-lg drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] tracking-widest">
              季度列表
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {seasons.map((season) => (
              <Link
                key={season.id}
                href={`/series/${media.id}/seasons/${season.id}`}
                className="surface-card interactive-media-card group flex cursor-pointer flex-col overflow-hidden rounded-xl text-left"
              >
                <div className="image-overlay relative aspect-2/3 w-full overflow-hidden">
                  {season.coverUrl ? (
                    <Image src={season.coverUrl} alt={`${season.title} 海报`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 20vw" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/25"><ImageIcon className="size-9" aria-hidden="true" /></div>
                  )}
                  <span className="image-label absolute left-2 top-2 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/75 backdrop-blur-md">第 {season.seasonNumber} 季</span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h4 className="mb-2 line-clamp-2 text-sm font-bold text-white/85 transition-colors group-hover:text-red-300">
                    {season.title}
                  </h4>
                  <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-white/50">
                    {season.releaseYearRange && <span>{season.releaseYearRange}</span>}
                    {season.releaseYearRange && <span>•</span>}
                    <span>{season.episodeCount} 集</span>
                  </div>
                </div>
              </Link>
            ))}
            {seasons.length === 0 && (
              <div className="surface-muted col-span-full rounded-xl border border-white/10 px-6 py-10 text-center text-sm text-white/60">
                暂无季集数据
              </div>
            )}
          </div>
        </div>
      )}
        
        {relatedContent && <div className={seasons ? "" : "mt-12"}>{relatedContent}</div>}
      </div>
    </>
  );
}
