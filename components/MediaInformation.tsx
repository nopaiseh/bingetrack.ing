import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import MediaBackLink, { DefaultMediaBackLink } from "./MediaBackLink";
import { Media, SeasonInfo } from "@/lib/types";
import { formatRuntime } from "@/lib/format-runtime";
import { heroWatermark, titleAccentIndex } from "@/lib/title-accent";
import { isUpcomingDate } from "@/lib/upcoming";
import SearchTag from "./SearchTag";
import { ratingTierLabel } from "./MediaRatingBadge";
import SeasonRow from "./SeasonRow";
import ClampedCopy from "./ClampedCopy";
import LetterTile from "./LetterTile";
import { resolveWatchStatus, WATCH_STATUSES } from "./watch-status";

/** 页头时长写成「2 小时 45 分」，和事实区的完整分钟写法分开。 */
function heroRuntime(runtime: number | null | undefined): string | null {
  return formatRuntime(runtime)?.replaceAll("分钟", "分") ?? null;
}

/** 元信息行里的年份。完整日期只取年；剧集的年份区间保留短横。 */
function releaseYearLabel(media: Media, releaseDateLabel?: string): string {
  if (releaseDateLabel && /^\d{4}/.test(releaseDateLabel) && !/^\d{4}-\d{2}-\d{2}/.test(releaseDateLabel)) {
    return releaseDateLabel.replace(/\s*-\s*/g, "–");
  }
  const year = String(media.release_year || media.date || "").match(/\d{4}/)?.[0] ?? "";
  return year;
}

/** 事实格里的上映日：有完整日期就用日期，否则用调用方传入的区间。 */
function releaseFact(media: Media, releaseDateLabel?: string): string {
  if (releaseDateLabel?.trim()) return releaseDateLabel.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(media.date)) return media.date.slice(0, 10);
  return releaseYearLabel(media, releaseDateLabel) || "—";
}

/** 海报。没有封面时用标题首字，不依赖后端的主色字段。 */
function MediaPoster({ media }: { media: Media }) {
  return (
    <div data-poster className="relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-[0_12px_30px_-16px_rgba(0,0,0,0.8)]">
      {media.cover_url ? (
        <Image src={media.cover_url} alt="" fill sizes="(max-width: 639px) 84px, 184px" className="object-cover" priority={!media.backdrop_url} />
      ) : (
        <LetterTile title={media.title} />
      )}
    </div>
  );
}

/** 当前观看状态。文案来自全站状态表，只展示，不提供会改数据的按钮。 */
function StatusPill({ status }: { status?: string }) {
  const config = resolveWatchStatus(status) ?? WATCH_STATUSES.want_to_watch;
  const solid = config.id === "want_to_watch";
  return (
    <span
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold ${
        solid ? "button-accent" : `border ${config.borderClass} ${config.surfaceClass} ${config.textClass}`
      }`}
    >
      <span className={`${config.icon} inline-block size-4`} aria-hidden="true" />
      {config.label}
    </span>
  );
}

/** 即将上映是发行状态，和已看 / 在看 / 想看分开。 */
function UpcomingChip() {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-sm font-medium text-[var(--accent-hover)]">
      即将上映
    </span>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-[var(--surface-panel)] px-4 py-3.5 sm:px-5 sm:py-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{children}</dd>
    </div>
  );
}

function SideRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3">
      <dt className="pt-2 text-sm text-fg-muted">{label}</dt>
      <dd className="flex min-w-0 flex-wrap gap-2">{children}</dd>
    </div>
  );
}

/** 演员名链到人物搜索；角色只作说明，不进链接的查询词。 */
function castHref(name: string) {
  return `/search?${new URLSearchParams({ q: name, type: "actor" }).toString()}`;
}

function directorHref(name: string) {
  return `/search?${new URLSearchParams({ q: name, type: "director" }).toString()}`;
}

/** 窄屏先露四位，其余用复选框展开，不用脚本；宽屏全部展示。 */
function CastRoster({ media }: { media: Media }) {
  const casts = media.casts ?? [];
  if (casts.length === 0) return <p className="text-sm text-fg-muted">-</p>;

  return (
    <div className="cast-roster">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {casts.map(/* 一张演员卡片：首字头像、姓名，有角色时附注饰演。 */ (name, index) => {
          const character = media.characters?.[index];
          return (
            <li key={`${name}-${index}`} className="cast-card min-w-0">
              <Link
                href={castHref(name)}
                className="surface-panel flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-3)]"
              >
                <LetterTile title={name} avatar />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-fg">{character ? `${name} ` : name}</span>
                  {character ? <span className="block truncate text-sm text-fg-muted">饰 {character}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {casts.length > 4 ? (
        <div className="cast-more-toggle mt-3 sm:mt-0">
          <input id="cast-more" type="checkbox" className="cast-more sr-only" />
          <label htmlFor="cast-more" className="inline-flex min-h-10 cursor-pointer items-center text-sm font-medium text-[var(--accent-hover)]">
            <span className="cast-more-closed">查看全部 {casts.length} 位</span>
            <span className="cast-more-open">收起</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

/** 组合页头、事实、简介、演员和季列表。没有剧照时页头改用较短的标题色渐变。 */
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
  const runtimeLabel = heroRuntime(media.runtime);
  const yearLabel = releaseYearLabel(media, releaseDateLabel);
  const upcoming = isUpcomingDate(media.date);
  const backdrop = media.backdrop_url?.trim() || "";
  const accent = titleAccentIndex(media.title);
  const watermark = heroWatermark(media.title, media.alternate_title);
  const typeLabel = media.type === "shows" ? "电视节目" : "电影";
  const seriesName = media.series?.[0];
  const status = displayStatus ?? media.status;
  const score = media.rating == null ? null : Number(media.rating).toFixed(1);
  const tier = ratingTierLabel(media.rating);
  const genres = media.genres?.slice(0, 2) ?? [];

  return (
    <>
      <header
        className={`detail-hero relative ${backdrop ? "pb-10 sm:pb-14" : "pb-6 sm:pb-8"}`}
        data-hero={backdrop ? "backdrop" : "fallback"}
        data-accent={accent}
      >
        {backdrop ? (
          <>
            <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover" />
            <div className="detail-hero-scrim" aria-hidden="true" />
          </>
        ) : null}
        {watermark ? <p className="detail-hero-mark" aria-hidden="true">{watermark}</p> : null}

        <div className="container relative z-10 mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
          <Suspense fallback={<DefaultMediaBackLink type={media.type === "shows" ? "shows" : "movies"} />}>
            <MediaBackLink type={media.type === "shows" ? "shows" : "movies"} />
          </Suspense>

          <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-start gap-x-3.5 gap-y-4 sm:grid-cols-[11.5rem_minmax(0,1fr)] sm:gap-x-8">
            <div className="col-start-1 row-start-1 row-span-2 w-full">
              <MediaPoster media={media} />
            </div>

            <div className="col-start-2 row-start-1 min-w-0">
              <p className="text-sm text-fg-muted">
                {typeLabel}
                {seriesName ? ` · ${seriesName} 系列` : ""}
              </p>
              <h1 className="mt-1 text-balance break-words text-3xl font-semibold tracking-tight text-fg sm:text-5xl">
                {media.title}
              </h1>
              {media.alternate_title && media.alternate_title !== media.title ? (
                <p className="mt-1 text-sm text-fg-secondary sm:text-base">{media.alternate_title}</p>
              ) : null}
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-fg-secondary">
                {yearLabel ? <span className="font-mono">{yearLabel}</span> : null}
                {runtimeLabel ? <><span aria-hidden="true" className="text-fg-subtle">·</span><span>{runtimeLabel}</span></> : null}
                {genres.map((genre) => (
                  <span key={genre} className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="text-fg-subtle">·</span>
                    {genre}
                  </span>
                ))}
                {upcoming ? <><span aria-hidden="true" className="text-fg-subtle">·</span><UpcomingChip /></> : null}
              </p>
            </div>

            <div className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <StatusPill status={status} />
              <a
                href={`https://www.themoviedb.org/search?query=${encodeURIComponent(media.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-fg-secondary transition-colors hover:text-fg"
              >
                <span className="i-material-symbols-open-in-new-rounded inline-block size-4" aria-hidden="true" />
                TMDB
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="container relative z-10 mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
          <Fact label="上映">
            <span className="font-mono">{releaseFact(media, releaseDateLabel)}</span>
          </Fact>
          <Fact label="导演">
            {media.directors && media.directors.length > 0 ? (
              <span className="inline-flex flex-wrap gap-x-1">
                {media.directors.map(/* 导演名可以搜到此人的作品，视觉上仍是一行文字。 */ (name, index) => (
                  <span key={name}>
                    {index > 0 ? "、" : ""}
                    <Link href={directorHref(name)} className="underline-offset-4 hover:text-[var(--accent-hover)] hover:underline">{name}</Link>
                  </span>
                ))}
              </span>
            ) : "—"}
          </Fact>
          <Fact label="地区 / 语言">
            {[...(media.regions ?? []), ...(media.languages ?? [])].join(" · ") || "—"}
          </Fact>
          <Fact label="我的评分">
            {score == null ? (
              <span className="text-fg-secondary">未评分</span>
            ) : (
              <span className="inline-flex items-baseline gap-2">
                <span className="font-mono text-base">{score}</span>
                {tier ? <span className="text-sm text-fg-muted">{tier}</span> : null}
              </span>
            )}
          </Fact>
        </dl>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
          <section>
            <h2 className="text-lg font-semibold text-fg">剧情简介</h2>
            <div className="mt-3">
              <ClampedCopy text={media.summary || "暂无简介。"} persistClamp expandLabel="展开全文 ↓" collapseLabel="收起全文 ↑" />
            </div>
          </section>

          <aside className="surface-panel rounded-2xl p-4 sm:p-5">
            <dl className="space-y-4">
              {media.series && media.series.length > 0 ? (
                <SideRow label="系列">
                  {media.series.map((name) => <SearchTag key={name} label={name} category="series" />)}
                </SideRow>
              ) : null}
              <SideRow label="类型">
                {media.genres?.length ? media.genres.map((name) => <SearchTag key={name} label={name} category="genre" />) : <span className="pt-2 text-sm text-fg-muted">—</span>}
              </SideRow>
              <SideRow label="地区">
                {media.regions?.length ? media.regions.map((name) => <SearchTag key={name} label={name} category="region" />) : <span className="pt-2 text-sm text-fg-muted">—</span>}
              </SideRow>
              <SideRow label="语言">
                {media.languages?.length ? media.languages.map((name) => <SearchTag key={name} label={name} category="language" />) : <span className="pt-2 text-sm text-fg-muted">—</span>}
              </SideRow>
              <SideRow label="原名">
                <span className="pt-2 text-sm text-fg">{media.alternate_title?.trim() || media.title}</span>
              </SideRow>
            </dl>
          </aside>
        </div>

        <section className="mt-10" aria-label="演员">
          <div className="mb-4 flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-fg">演员</h2>
            {(media.casts?.length ?? 0) > 0 ? (
              <span className="font-mono text-sm text-fg-muted">{media.casts?.length}</span>
            ) : null}
          </div>
          <CastRoster media={media} />
        </section>

        {seasons ? <SeasonRow seriesId={media.id} seasons={seasons} /> : null}
        {relatedContent ? <div className={seasons ? "empty:hidden" : "mt-12 empty:hidden"}>{relatedContent}</div> : null}
      </div>
    </>
  );
}
