import { notFound } from "next/navigation";
import { getRelatedBySeries } from "@/lib/functions/media-repo";
import MediaInformation from "@/components/MediaInformation";
import MediaRow from "@/components/MediaRow";
import { RelatedMediaLoadingSkeleton } from "@/components/LoadingSkeletons";
import { Suspense } from "react";
import { getCachedMediaById } from "@/lib/functions/cached-media";
import type { Metadata } from "next";
import { buildMediaJsonLd, buildMediaMetadata, serializeJsonLd } from "@/lib/seo/media";

// 详情页按需生成，缓存 60 秒后允许重新验证。
export const revalidate = 60;

/** 构建时不枚举详情 ID，让动态详情路由在访问时按需生成。 */
export function generateStaticParams() { return []; }

/** 用缓存的电影详情生成页面与分享元数据；无记录时返回未找到标题。 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const movie = await getCachedMediaById(id);
  if (!movie) return { title: "电影未找到" };
  return buildMediaMetadata(movie);
}

/** 并行读取各作品系列的相关条目，按系列分组展示横向卡片列表。 */
async function RelatedMovies({ seriesNames, currentId }: { seriesNames: string[]; currentId: string }) {
  const relatedGroups = await Promise.all(seriesNames.map(/* 读取该作品系列中除当前作品外的条目，并保留系列名作为分组标题。 */ async (seriesName) => ({
    seriesName,
    items: await getRelatedBySeries(seriesName, currentId),
  })));

  return (
    <div className="space-y-12">
      {relatedGroups.map(/* 为一个作品系列渲染相关媒体横向列表。 */ ({ seriesName, items }) => (
        <MediaRow key={seriesName} title={`《${seriesName}》系列`} items={items} />
      ))}
    </div>
  );
}

/** 读取电影详情，缺失时进入 404；输出详情、结构化数据及异步相关作品区。 */
export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movie = await getCachedMediaById(id);
  if (!movie) notFound();
  const jsonLd = buildMediaJsonLd(movie);

  return (
    <div className="relative min-h-screen text-white/90 selection:bg-red-500/30 selection:text-white font-sans overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <MediaInformation
        media={movie}
        seasons={null}
        releaseDateLabel={movie.date}
        relatedContent={movie.series && movie.series.length > 0 ? (
          <Suspense fallback={<RelatedMediaLoadingSkeleton />}>
            <RelatedMovies seriesNames={movie.series} currentId={movie.id} />
          </Suspense>
        ) : null}
      />
    </div>
  );
}
