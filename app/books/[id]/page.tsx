import { notFound } from "next/navigation";
import { Suspense } from "react";
import BookInformation from "@/components/BookInformation";
import MediaRow from "@/components/MediaRow";
import { RelatedMediaLoadingSkeleton } from "@/components/LoadingSkeletons";
import { getRelatedBySeries } from "@/lib/functions/media-repo";
import { getCachedMediaById } from "@/lib/functions/cached-media";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import type { Metadata } from "next";
import { buildMediaJsonLd, buildMediaMetadata, serializeJsonLd } from "@/lib/seo/media";

// 按需生成；只靠保存时的 revalidateTag 失效，不定时重建。
export const revalidate = false;

/** 构建时不枚举详情 ID，访问时按需生成。 */
export function generateStaticParams() {
  return [];
}

/** 用缓存的图书详情生成页面与分享元数据。 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const book = await getCachedMediaById(id);
  if (!book) return { title: "图书未找到" };
  return buildMediaMetadata(book);
}

/** 读取 books 表上的可空出版社／页数；表未迁移时降级为空。 */
async function loadBookMeta(id: string): Promise<{ publisher: string | null; pageCount: number | null }> {
  try {
    const db = getSupabasePublicServer();
    const { data, error } = await db.from("books").select("page_count,publisher").eq("media_item_id", id).maybeSingle();
    if (error || !data) return { publisher: null, pageCount: null };
    return {
      publisher: data.publisher ?? null,
      pageCount: data.page_count != null ? Number(data.page_count) : null,
    };
  } catch {
    return { publisher: null, pageCount: null };
  }
}

/** 并行读取各作品系列的相关图书，按系列分组展示横向卡片列表。 */
async function RelatedBooks({ seriesNames, currentId }: { seriesNames: string[]; currentId: string }) {
  const relatedGroups = await Promise.all(
    seriesNames.map(
      /* 读取该作品系列中除当前作品外的条目，并保留系列名作为分组标题。 */ async (seriesName) => ({
        seriesName,
        items: await getRelatedBySeries(seriesName, currentId),
      }),
    ),
  );
  // 系列里没有其他条目时不渲染任何节点，外层留白容器随之隐藏。
  const groups = relatedGroups.filter(/* 只保留有其他条目的系列分组。 */ ({ items }) => items.length > 0);
  if (groups.length === 0) return null;

  return (
    <div className="space-y-12">
      {groups.map(
        /* 为一个作品系列渲染相关媒体横向列表；开启系列序号角标（字段缺失时不显示）。 */ ({ seriesName, items }) => (
          <MediaRow key={seriesName} title={`《${seriesName}》系列`} items={items} type="book" showSeriesPosition />
        ),
      )}
    </div>
  );
}

/** 读取图书详情；缺失或类型不符时 404。展示作者、出版社、页数与三态阅读状态，无进度条。 */
export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getCachedMediaById(id);
  if (!book) notFound();
  if (book.type !== "books") notFound();

  const meta = await loadBookMeta(id);
  const jsonLd = buildMediaJsonLd(book);

  return (
    <div className="relative text-fg selection:bg-[var(--accent-soft)] selection:text-white font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <BookInformation
        media={book}
        publisher={meta.publisher}
        pageCount={meta.pageCount}
        relatedContent={
          book.series && book.series.length > 0 ? (
            <Suspense fallback={<RelatedMediaLoadingSkeleton />}>
              <RelatedBooks seriesNames={book.series} currentId={book.id} />
            </Suspense>
          ) : null
        }
      />
    </div>
  );
}
