import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import MediaBackLink, { DefaultMediaBackLink } from "@/components/MediaBackLink";
import ClampedCopy from "@/components/ClampedCopy";
import LetterTile from "@/components/LetterTile";
import ReadStatusSegment from "@/components/ReadStatusSegment";
import SearchTag from "@/components/SearchTag";
import { ratingTierLabel } from "@/components/MediaRatingBadge";
import type { Media } from "@/lib/types";

function BookPoster({ title, coverUrl }: { title: string; coverUrl: string }) {
  return (
    <div
      data-poster
      className="relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-[0_12px_30px_-16px_rgba(0,0,0,0.8)]"
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes="(max-width: 639px) 64px, 96px"
          className="object-cover"
          preload
          fetchPriority="high"
        />
      ) : (
        <LetterTile title={title} decorative />
      )}
    </div>
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

function authorHref(name: string) {
  return `/search?${new URLSearchParams({ q: name, type: "book" }).toString()}`;
}

/** 图书详情：封面／首字块、三态阅读状态、作者／出版社／页数等字段；无进度条。 */
export default function BookInformation({
  media,
  publisher,
  pageCount,
}: {
  media: Media;
  publisher?: string | null;
  pageCount?: number | null;
}) {
  const year = String(media.release_year || media.date || "").match(/\d{4}/)?.[0] ?? "";
  const score = media.rating == null ? null : Number(media.rating).toFixed(1);
  const tier = ratingTierLabel(media.rating);
  const alternate = media.alternate_title && media.alternate_title !== media.title ? media.alternate_title : null;
  const authors = (media.authors ?? []).filter(Boolean);
  const publisherLabel = publisher?.trim() || null;
  const pages = pageCount != null && pageCount > 0 ? pageCount : null;

  const metaItems = [
    authors.length > 0 ? (
      <span key="authors" className="inline-flex flex-wrap gap-x-1">
        {authors.map((name, index) => (
          <span key={`${name}-${index}`}>
            {index > 0 ? "、" : ""}
            <Link
              href={authorHref(name)}
              className="underline-offset-4 hover:text-[var(--accent-hover)] hover:underline"
            >
              {name}
            </Link>
          </span>
        ))}
      </span>
    ) : null,
    year ? (
      <span key="year" className="font-mono text-fg-secondary">
        {year}
      </span>
    ) : null,
    publisherLabel ? <span key="publisher">{publisherLabel}</span> : null,
    pages != null ? (
      <span key="pages" className="font-mono">
        {pages} 页
      </span>
    ) : null,
    <span key="type">图书</span>,
  ].filter((item) => item != null);

  const factItems = [
    year || media.date ? (
      <Fact key="date" label="出版">
        <span className="font-mono">
          {/^\d{4}-\d{2}-\d{2}/.test(media.date) ? media.date.slice(0, 10) : year || "—"}
        </span>
      </Fact>
    ) : null,
    authors.length > 0 ? (
      <Fact key="authors" label="作者">
        <span className="inline-flex flex-wrap gap-x-1">
          {authors.map((name, index) => (
            <span key={`${name}-${index}`}>
              {index > 0 ? "、" : ""}
              <Link
                href={authorHref(name)}
                className="underline-offset-4 hover:text-[var(--accent-hover)] hover:underline"
              >
                {name}
              </Link>
            </span>
          ))}
        </span>
      </Fact>
    ) : null,
    publisherLabel ? (
      <Fact key="publisher" label="出版社">
        {publisherLabel}
      </Fact>
    ) : null,
    pages != null ? (
      <Fact key="pages" label="页数">
        <span className="font-mono">{pages}</span>
      </Fact>
    ) : null,
    <Fact key="rating" label="我的评分">
      {score == null ? (
        <span className="text-fg-secondary">未评分</span>
      ) : (
        <span className="inline-flex items-baseline gap-2">
          <span className="font-mono text-base">{score}</span>
          {tier ? <span className="text-sm text-fg-muted">{tier}</span> : null}
        </span>
      )}
    </Fact>,
  ].filter((item) => item != null);

  return (
    <>
      <header className="container mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        <Suspense fallback={<DefaultMediaBackLink type="books" />}>
          <MediaBackLink type="books" />
        </Suspense>

        <div className="flex items-start gap-4 sm:gap-5">
          <div className="w-16 shrink-0 sm:w-24">
            <BookPoster title={media.title} coverUrl={media.cover_url} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-balance break-words text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              {media.title}
            </h1>
            {alternate ? <p className="mt-1 text-sm text-fg-secondary">{alternate}</p> : null}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
              {metaItems.flatMap((item, index) =>
                index === 0
                  ? [item]
                  : [
                      <span key={`dot-${index}`} aria-hidden="true" className="text-fg-subtle">
                        ·
                      </span>,
                      item,
                    ],
              )}
            </p>
            <div className="mt-4">
              <ReadStatusSegment status={media.status} />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 pb-8 sm:px-6 md:pb-12 lg:px-8">
        {factItems.length > 0 ? (
          <dl
            className={`grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] ${
              factItems.length >= 5
                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                : factItems.length === 4
                  ? "grid-cols-2 sm:grid-cols-4"
                  : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {factItems}
          </dl>
        ) : null}

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
          <section>
            <h2 className="text-lg font-semibold text-fg">简介</h2>
            <div className="mt-3">
              <ClampedCopy
                text={media.summary || "暂无简介。"}
                persistClamp
                expandLabel="展开全文 ↓"
                collapseLabel="收起全文 ↑"
              />
            </div>
          </section>

          <aside className="surface-panel rounded-2xl p-4 sm:p-5">
            <dl className="space-y-4">
              {media.series && media.series.length > 0 ? (
                <SideRow label="系列">
                  {media.series.map((name) => (
                    <SearchTag key={name} label={name} category="series" />
                  ))}
                </SideRow>
              ) : null}
              {media.genres?.length ? (
                <SideRow label="类型">
                  {media.genres.map((name) => (
                    <SearchTag key={name} label={name} category="genre" />
                  ))}
                </SideRow>
              ) : null}
              {media.languages?.length ? (
                <SideRow label="语言">
                  {media.languages.map((name) => (
                    <SearchTag key={name} label={name} category="language" />
                  ))}
                </SideRow>
              ) : null}
              {(alternate || media.title) && (
                <SideRow label="原名">
                  <span className="pt-2 text-sm text-fg">{alternate || media.title}</span>
                </SideRow>
              )}
            </dl>
          </aside>
        </div>
      </div>
    </>
  );
}
