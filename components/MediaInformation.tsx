import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import MediaBackLink, { DefaultMediaBackLink } from "./MediaBackLink";
import { Media, SeasonInfo } from "@/lib/types";
import SearchTag from "./SearchTag";
import MediaRatingBadge from "./MediaRatingBadge";

/** 展示并预加载详情海报；无图片时显示暂无海报占位。 */
function MediaPoster({ media }: { media: Media }) {
  return (
    <div className="relative w-full max-w-80 shrink-0 self-center lg:w-80 lg:self-start">
      <div className="surface-muted relative z-10 aspect-2/3 w-full overflow-hidden rounded-2xl border border-white/15 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl ring-1 ring-white/10 transition-transform duration-500 hover:scale-[1.02]">
        {media.cover_url ? (
          <Image src={media.cover_url} alt={media.title} fill sizes="(max-width: 393px) calc(100vw - 74px), 320px" className="object-cover transition-transform duration-700 hover:scale-105" priority />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-2">
            <span className="i-material-symbols-image-outline-rounded inline-block size-10 drop-shadow-md" aria-hidden="true" />
            <span className="text-sm">暂无海报</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** 已看和在看状态分别显示对应徽标，其他状态统一显示想要看。 */
function StatusBadge({ status }: { status?: string }) {
  if (status === "watched") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold backdrop-blur-2xl shadow-[0_4px_12px_rgba(16,185,129,0.25)] drop-shadow-[0_0_6px_rgba(16,185,129,0.4)] cursor-default transition-all duration-300 hover:bg-emerald-500/25 hover:shadow-[0_4px_16px_rgba(16,185,129,0.35)]">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        已观看
      </div>
    );
  }

  if (status === "watching") {
    return (
      <div className="flex cursor-default items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/15 px-3 py-1.5 text-xs font-bold text-sky-300 shadow-[0_4px_12px_rgba(56,189,248,0.2)] backdrop-blur-2xl transition-all duration-300 hover:bg-sky-400/25 hover:shadow-[0_4px_16px_rgba(56,189,248,0.3)]">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75 duration-1000" />
          <span className="relative inline-flex size-2 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.8)]" />
        </span>
        正在看
      </div>
    );
  }

  return (
    <div className="surface-muted interactive-control flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 shadow-[0_4px_10px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition-all duration-300 hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-light)] hover:shadow-[0_4px_15px_var(--accent-glow-soft)]">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
      </svg>
      想要看
    </div>
  );
}

/** 将属性标签与内容排成响应式元数据行。 */
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

/** 为详情内容区渲染带红色标记的分区标题。 */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-5 w-1 rounded-sm bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]" />
      <h2 className="text-sm font-bold tracking-widest text-white/90">{children}</h2>
    </div>
  );
}

/** 展示媒体的发行信息、类型、地区、语言和系列标签，并按参数决定是否包含演职员。 */
function MediaMetadata({ media, includePeople = true, releaseDateLabel }: { media: Media; includePeople?: boolean; releaseDateLabel?: string }) {
  return (
    <div className="flex flex-col">
      {releaseDateLabel !== undefined && (
        <MetadataRow label="上映">
          {releaseDateLabel
            ? <span className="surface-subtle inline-flex items-center rounded-lg border border-white/8 px-3.5 py-1.5 text-sm font-medium tracking-wide text-white/70">{releaseDateLabel}</span>
            : <span className="text-sm text-white/30 sm:pt-1">-</span>}
        </MetadataRow>
      )}
      <MetadataRow label="类型">
        {media.genres?.length > 0 
          ? media.genres.map(/* 将媒体类型名称渲染为类型筛选链接。 */ (g) => <SearchTag key={g} label={g} category="genre" />)
          : <span className="text-white/30 text-sm sm:pt-1">-</span>}
      </MetadataRow>
        
      <MetadataRow label="地区">
        {media.regions && media.regions.length > 0 
          ? media.regions.map(/* 将地区名称渲染为地区筛选链接。 */ (r) => <SearchTag key={r} label={r} category="region" />)
          : <span className="text-white/30 text-sm sm:pt-1">-</span>}
      </MetadataRow>

      <MetadataRow label="语言">
        {media.languages?.length > 0 
          ? media.languages.map(/* 将语言名称渲染为语言筛选链接。 */ (l) => <SearchTag key={l} label={l} category="language" />)
          : <span className="text-white/30 text-sm sm:pt-1">-</span>}
      </MetadataRow>

      {media.series && media.series.length > 0 && (
        <MetadataRow label="系列">
          {media.series.map(/* 将作品系列名渲染为限定系列分类的搜索链接。 */ (seriesName) => (
            <SearchTag key={seriesName} label={seriesName} category="series" />
          ))}
        </MetadataRow>
      )}

      {includePeople && <MediaCredits media={media} />}
    </div>
  );
}

/** 分别展示导演和主演搜索标签，缺少名单时显示占位符。 */
function MediaCredits({ media }: { media: Media }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionHeading>导演</SectionHeading>
        <div className="flex flex-wrap gap-2.5">
          {media.directors && media.directors.length > 0
            ? media.directors.map(/* 将导演姓名渲染为导演分类搜索链接。 */ (director) => <SearchTag key={director} label={director} category="director" />)
            : <span className="text-sm text-white/30">-</span>}
        </div>
      </div>
      <div>
        <SectionHeading>主演</SectionHeading>
        <div className="flex flex-wrap gap-2.5">
          {media.casts && media.casts.length > 0
            ? media.casts.map(/* 将演员姓名渲染为演员分类搜索链接。 */ (castMember) => <SearchTag key={castMember} label={castMember} category="cast" />)
            : <span className="text-sm text-white/30">-</span>}
        </div>
      </div>
    </div>
  );
}

/** 组合返回入口、海报、标题、状态、属性和简介，并根据传入季列表展示季度入口。 */
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
      {/* 顶部电影氛围背景 (Cinematic Header Ambient Glow) */}
      {media.cover_url && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 h-[65vh] overflow-hidden opacity-20 blur-[100px] saturate-200 -z-10"
        >
          <Image
            src={media.cover_url}
            alt=""
            fill
            className="object-cover scale-150 -translate-y-1/4"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--canvas)]/70 to-[var(--canvas)]" />
        </div>
      )}

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
                <h1 className="font-serif-movie text-balance text-3xl font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] sm:text-4xl lg:text-5xl">
                  {media.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                <MediaRatingBadge rating={media.rating} size="lg" showTier />

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
            <div className="w-1 h-5 bg-[var(--accent)] rounded-sm shadow-[0_0_8px_var(--accent-glow)]"></div> 
            <h3 className="text-white/90 font-bold text-lg drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] tracking-widest">
              季度列表
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {seasons.map(/* 将一季渲染为含海报、标题、年份范围和集数的详情链接。 */ (season) => (
              <Link
                key={season.id}
                href={`/series/${media.id}/seasons/${season.id}`}
                className="surface-card interactive-media-card group flex cursor-pointer flex-col overflow-hidden rounded-xl text-left"
              >
                <div className="image-overlay relative aspect-2/3 w-full overflow-hidden">
                  {season.coverUrl ? (
                    <Image src={season.coverUrl} alt={`${season.title} 海报`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 20vw" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/30"><span className="i-material-symbols-image-outline-rounded inline-block size-9" aria-hidden="true" /></div>
                  )}
                  <span className="image-label absolute left-2 top-2 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/75 backdrop-blur-md">第 {season.seasonNumber} 季</span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h4 className="mb-2 line-clamp-2 text-sm font-bold text-white/85 transition-colors group-hover:text-[var(--accent-hover)]">
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
