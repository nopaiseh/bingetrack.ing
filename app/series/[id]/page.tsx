import { notFound } from "next/navigation";
import { getMediaById, getRelatedBySeries, getSeasonsBySeriesId } from "@/lib/functions/media-repo";
import MediaInformation from "@/components/MediaInformation";
import MediaRow from "@/components/MediaRow";
import { RelatedMediaLoadingSkeleton } from "@/components/LoadingSkeletons";
import { Suspense } from "react";
import { cache } from "react";
import type { Metadata } from "next";
import { buildMediaJsonLd, buildMediaMetadata, serializeJsonLd } from "@/lib/seo/media";

export const revalidate = 60;

const getCachedMediaById = cache(getMediaById);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const series = await getCachedMediaById(id);
  if (!series) return { title: "电视剧未找到" };
  return buildMediaMetadata(series);
}

async function RelatedSeries({ seriesNames, currentId }: { seriesNames: string[]; currentId: string }) {
  const relatedGroups = await Promise.all(seriesNames.map(async (seriesName) => ({
    seriesName,
    items: await getRelatedBySeries(seriesName, currentId),
  })));

  return (
    <div className="space-y-12">
      {relatedGroups.map(({ seriesName, items }) => (
        <MediaRow key={seriesName} title={`《${seriesName}》系列`} items={items} />
      ))}
    </div>
  );
}

export default async function SeriesDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnToSearch = query.from === "/search" || query.from?.startsWith("/search?");
  const [series, seasons] = await Promise.all([
    getCachedMediaById(id),
    getSeasonsBySeriesId(id),
  ]);
  if (!series) notFound();
  const jsonLd = buildMediaJsonLd(series);

  const episodeYears = seasons.flatMap((season) => season.releaseYearRange?.match(/\d{4}/g) ?? []);
  const firstEpisodeYear = episodeYears.length > 0 ? Math.min(...episodeYears.map(Number)) : null;
  const lastEpisodeYear = episodeYears.length > 0 ? Math.max(...episodeYears.map(Number)) : null;
  const releaseYearRange = firstEpisodeYear !== null && lastEpisodeYear !== null
    ? (firstEpisodeYear === lastEpisodeYear ? String(firstEpisodeYear) : `${firstEpisodeYear} - ${lastEpisodeYear}`)
    : series.date?.slice(0, 4) ?? "";
  const totalEpisodes = seasons.reduce((total, season) => total + season.episodeCount, 0);
  const watchedEpisodes = seasons.reduce((total, season) => total + season.watchedEpisodeCount, 0);
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
        backHref={returnToSearch ? query.from : undefined}
        backLabel={returnToSearch ? "返回搜索页" : undefined}
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
