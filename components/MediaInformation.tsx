import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import MediaBackLink, { DefaultMediaBackLink } from "./MediaBackLink";
import { Media, SeasonInfo } from "@/lib/types";
import { formatRuntime } from "@/lib/format-runtime";
import SearchTag from "./SearchTag";
import MediaRatingBadge from "./MediaRatingBadge";
import SeasonRow from "./SeasonRow";
import ClampedCopy from "./ClampedCopy";

/** 窄屏用小海报贴着标题，宽屏恢复左侧大海报。无图片时显示暂无海报占位。 */
function MediaPoster({ media }: { media: Media }) {
  return (
    <div data-poster className="surface-card relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] lg:rounded-2xl lg:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] lg:transition-transform lg:duration-500 lg:hover:scale-[1.02]">
      {media.cover_url ? (
        <Image src={media.cover_url} alt={media.title} fill sizes="(max-width: 1023px) 112px, 320px" className="object-cover" priority />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-fg-muted">
          <span className="i-material-symbols-image-outline-rounded inline-block size-6 drop-shadow-md lg:size-10" aria-hidden="true" />
          <span className="hidden text-sm lg:inline">暂无海报</span>
        </div>
      )}
    </div>
  );
}

/** 已看和在看状态分别显示对应徽标，其他状态统一显示想要看。 */
function StatusBadge({ status }: { status?: string }) {
  if (status === "watched") {
    return (
      <div className="flex cursor-default items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--ok)_45%,var(--border))] bg-[var(--ok-soft)] px-3 py-1.5 text-sm font-medium text-[var(--ok)]">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        已观看
      </div>
    );
  }

  if (status === "watching") {
    return (
      <div className="flex cursor-default items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--warn)_45%,var(--border))] bg-[var(--warn-soft)] px-3 py-1.5 text-sm font-medium text-[var(--warn)]">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--warn)] opacity-75 duration-1000" />
          <span className="relative inline-flex size-2 rounded-full bg-[var(--warn)]" />
        </span>
        正在看
      </div>
    );
  }

  return (
    <div className="interactive-control flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium text-fg-secondary transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)] hover:text-fg">
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
    <div className="group -mx-3 flex items-baseline gap-3 rounded-xl border-b border-white/10 px-3 py-2 transition-colors last:border-0 hover:bg-white/5 sm:gap-6 sm:py-3">
      <span className="w-12 shrink-0 text-sm font-medium tracking-widest text-fg-subtle transition-colors group-hover:text-fg-secondary sm:w-16 sm:pt-1 sm:text-base">
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
      <h2 className="text-sm font-semibold tracking-wider text-fg">{children}</h2>
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
            ? <span className="surface-subtle inline-flex items-center rounded-lg border border-white/8 px-3.5 py-1.5 text-sm font-medium tracking-wide text-fg-secondary">{releaseDateLabel}</span>
            : <span className="text-sm text-fg-subtle sm:pt-1">-</span>}
        </MetadataRow>
      )}
      <MetadataRow label="类型">
        {media.genres?.length > 0 
          ? media.genres.map(/* 将媒体类型名称渲染为类型筛选链接。 */ (g) => <SearchTag key={g} label={g} category="genre" />)
          : <span className="text-fg-subtle text-sm sm:pt-1">-</span>}
      </MetadataRow>
        
      <MetadataRow label="地区">
        {media.regions && media.regions.length > 0 
          ? media.regions.map(/* 将地区名称渲染为地区筛选链接。 */ (r) => <SearchTag key={r} label={r} category="region" />)
          : <span className="text-fg-subtle text-sm sm:pt-1">-</span>}
      </MetadataRow>

      <MetadataRow label="语言">
        {media.languages?.length > 0 
          ? media.languages.map(/* 将语言名称渲染为语言筛选链接。 */ (l) => <SearchTag key={l} label={l} category="language" />)
          : <span className="text-fg-subtle text-sm sm:pt-1">-</span>}
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
            : <span className="text-sm text-fg-subtle">-</span>}
        </div>
      </div>
      <div>
        <SectionHeading>主演</SectionHeading>
        <div className="flex flex-wrap gap-2.5">
          {media.casts && media.casts.length > 0
            ? media.casts.map(/* 将主演姓名渲染为主演分类搜索链接，有角色名时附注饰演角色。 */ (castMember, index) => (
              <SearchTag key={castMember} label={castMember} category="cast" note={media.characters?.[index] ? `饰 ${media.characters[index]}` : undefined} />
            ))
            : <span className="text-sm text-fg-subtle">-</span>}
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
  const runtimeLabel = formatRuntime(media.runtime);

  return (
    <>
      <div className="container relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-24 sm:px-6 lg:px-8">
        <Suspense fallback={<DefaultMediaBackLink type={media.type === "shows" ? "shows" : "movies"} />}>
          <MediaBackLink type={media.type === "shows" ? "shows" : "movies"} />
        </Suspense>

        <div className="surface-panel rounded-3xl p-5 sm:p-6 lg:p-8">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-3.5 gap-y-3 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-12 lg:gap-y-4">
            <div className="col-start-1 row-start-1 row-span-2 w-full self-start lg:row-span-3">
              <MediaPoster media={media} />
            </div>

            <div className="col-start-2 row-start-1 min-w-0 self-start">
              <h1 className="font-serif-movie text-balance break-words bg-linear-to-b from-white via-white/95 to-white/75 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-4xl lg:mt-4 lg:text-5xl">
                {media.title}
              </h1>
            </div>

            <div className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 self-start text-sm font-medium lg:gap-4">
              <MediaRatingBadge rating={media.rating} size="lg" showTier className="max-lg:[&>span]:hidden" />
              {runtimeLabel ? (
                <>
                  <span className="hidden text-white/20 sm:inline" aria-hidden="true">•</span>
                  <span className="text-fg-muted">{runtimeLabel}</span>
                </>
              ) : null}
              <div className="md:ml-auto">
                <StatusBadge status={displayStatus ?? media.status} />
              </div>
            </div>

            <div className="col-span-2 col-start-1 row-start-4 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-3">
              <MediaMetadata media={media} includePeople={false} releaseDateLabel={releaseDateLabel} />
            </div>

            <div className="col-span-2 row-start-3 min-w-0 border-t border-white/10 pt-4 lg:row-start-4 lg:mt-4 lg:pt-6">
              <SectionHeading>剧情简介</SectionHeading>
              <ClampedCopy text={media.summary || "暂无简介。"} />
            </div>

            <div className="col-span-2 row-start-5 min-w-0 border-t border-white/10 pt-6">
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
