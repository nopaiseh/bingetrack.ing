import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import MediaBackLink, { DefaultMediaBackLink } from "./MediaBackLink";
import { Media, SeasonInfo } from "@/lib/types";
import { formatRuntime } from "@/lib/format-runtime";
import SearchTag from "./SearchTag";
import MediaRatingBadge from "./MediaRatingBadge";
import ExpandableCastList from "./ExpandableCastList";
import SeasonRow from "./SeasonRow";

/** 展示并预加载详情海报；无图片时显示暂无海报占位。 */
function MediaPoster({ media }: { media: Media }) {
  return (
    <div className="relative w-full max-w-80 shrink-0 self-center lg:w-80 lg:self-start">
      <div className="surface-card relative z-10 aspect-2/3 w-full overflow-hidden rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] transition-transform duration-500 hover:scale-[1.02]">
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
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium backdrop-blur-2xl cursor-default transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        已观看
      </div>
    );
  }

  if (status === "watching") {
    return (
      <div className="flex cursor-default items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300 backdrop-blur-2xl transition-colors">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75 duration-1000" />
          <span className="relative inline-flex size-2 rounded-full bg-sky-300" />
        </span>
        正在看
      </div>
    );
  }

  return (
    <div className="surface-muted interactive-control flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-2xl transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white">
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
      <div className="h-4 w-1 rounded-full bg-[var(--accent)] opacity-85" />
      <h2 className="text-sm font-semibold tracking-wider text-white/90">{children}</h2>
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
        <ExpandableCastList casts={media.casts} initialLimit={12} />
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
  const runtimeLabel = formatRuntime(media.runtime);

  return (
    <>
      {/* 顶部电影氛围光：海报模糊后固定铺在视口顶部，为详情面板的玻璃层提供可透射的色彩。 */}
      {media.cover_url && (
        <div
          aria-hidden="true"
          className="page-ambient fixed -z-10 h-[85vh]"
        >
          <Image
            src={media.cover_url}
            alt=""
            fill
            sizes="640px"
            className="object-cover"
            priority={false}
          />
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
                <h1 className="font-serif-movie text-balance text-3xl font-bold tracking-tight bg-linear-to-b from-white via-white/95 to-white/75 bg-clip-text text-transparent sm:text-4xl lg:text-5xl">
                  {media.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                <MediaRatingBadge rating={media.rating} size="lg" showTier />

                {runtimeLabel && (
                  <>
                    <span className="text-white/20 hidden sm:inline">•</span>
                    <span className="text-white/60">
                      {runtimeLabel}
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
            <div className="mb-8">
              <SectionHeading>剧情简介</SectionHeading>
              <p className="text-left text-sm leading-7 tracking-wide text-white/75 wrap-break-word md:text-base">
                {media.summary || "暂无简介。"}
              </p>
            </div>
            <div className="border-t border-white/10 pt-6">
              <MediaCredits media={media} />
            </div>
          </div>
        </div>
      
      {seasons && (
        <SeasonRow seriesId={media.id} seasons={seasons} />
      )}
        
        {relatedContent && <div className={seasons ? "empty:hidden" : "mt-12 empty:hidden"}>{relatedContent}</div>}
      </div>
    </>
  );
}
