import { notFound } from "next/navigation";
import { getRelatedBySeries } from "@/lib/functions/media-repo";
import MediaInformation from "@/components/MediaInformation";
import MediaRow from "@/components/MediaRow";
import { RelatedMediaLoadingSkeleton } from "@/components/LoadingSkeletons";
import { Suspense } from "react";
import { getCachedMediaById, getCachedSeasonsBySeriesId } from "@/lib/functions/cached-media";
import type { Metadata } from "next";
import { buildMediaJsonLd, buildMediaMetadata, serializeJsonLd } from "@/lib/seo/media";

// 详情页按需生成，缓存 60 秒后允许重新验证。
export const revalidate = 60;

/** 构建时不枚举电视剧 ID，详情页由访问触发按需生成。 */
export function generateStaticParams() { return []; }

/** 用缓存的电视剧详情生成页面与分享元数据；无记录时返回未找到标题。 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const series = await getCachedMediaById(id);
  if (!series) return { title: "电视剧未找到" };
  return buildMediaMetadata(series);
}

/** 并行读取各作品系列的其他条目，并按作品系列分组展示。 */
async function RelatedSeries({ seriesNames, currentId }: { seriesNames: string[]; currentId: string }) {
  const relatedGroups = await Promise.all(seriesNames.map(/* 查询一个作品系列中的其他条目，保留系列名用于展示。 */ async (seriesName) => ({
    seriesName,
    items: await getRelatedBySeries(seriesName, currentId),
  })));

  return (
    <div className="space-y-12">
      {relatedGroups.map(/* 将一个相关作品分组渲染为横向卡片列表。 */ ({ seriesName, items }) => (
        <MediaRow key={seriesName} title={`《${seriesName}》系列`} items={items} />
      ))}
    </div>
  );
}

/** 并行加载电视剧与季摘要，汇总剧集年份和观看进度，再展示详情、各季和相关作品。 */
export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [series, seasons] = await Promise.all([
    getCachedMediaById(id),
    getCachedSeasonsBySeriesId(id),
  ]);
  if (!series) notFound();
  const jsonLd = buildMediaJsonLd(series);

  const episodeYears = seasons.flatMap(/* 从季的年份范围提取四位年份，缺失时不贡献年份。 */ (season) => season.releaseYearRange?.match(/\d{4}/g) ?? []);
  const firstEpisodeYear = episodeYears.length > 0 ? Math.min(...episodeYears.map(Number)) : null;
  const lastEpisodeYear = episodeYears.length > 0 ? Math.max(...episodeYears.map(Number)) : null;
  const releaseYearRange = firstEpisodeYear !== null && lastEpisodeYear !== null
    ? (firstEpisodeYear === lastEpisodeYear ? String(firstEpisodeYear) : `${firstEpisodeYear} - ${lastEpisodeYear}`)
    : series.date?.slice(0, 4) ?? "";
  const totalEpisodes = seasons.reduce(/* 将本季集数累加到电视剧总集数。 */ (total, season) => total + season.episodeCount, 0);
  const watchedEpisodes = seasons.reduce(/* 将本季已看集数累加到电视剧已看总集数。 */ (total, season) => total + season.watchedEpisodeCount, 0);
  const episodeDerivedStatus = totalEpisodes === 0
    ? series.status
    : watchedEpisodes === totalEpisodes
      ? "watched"
      : watchedEpisodes > 0
        ? "watching"
        : "unwatched";

  return (
    <div className="relative min-h-screen text-white/90 selection:bg-red-500/30 selection:text-white font-sans overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <MediaInformation
        media={series}
        seasons={seasons}
        releaseDateLabel={releaseYearRange}
        displayStatus={episodeDerivedStatus}
        relatedContent={series.series && series.series.length > 0 ? (
          <Suspense fallback={<RelatedMediaLoadingSkeleton />}>
            <RelatedSeries seriesNames={series.series} currentId={series.id} />
          </Suspense>
        ) : null}
      />
    </div>
  );
}
