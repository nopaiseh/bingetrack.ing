import { notFound } from "next/navigation";
import { getMediaById, getRelatedBySeries, getSeasonsBySeriesId } from "@/lib/functions/media-repo";
import MediaInformation from "@/components/MediaInformation";
import { Media } from "@/lib/types";
import MediaRow from "@/components/MediaRow";
import { RelatedMediaLoadingSkeleton } from "@/components/LoadingSkeletons";
import { Suspense } from "react";

export const revalidate = 60;

async function RelatedSeries({ seriesName, currentId }: { seriesName: string; currentId: string }) {
  const relatedMedia: Media[] = await getRelatedBySeries(seriesName, currentId);
  return <MediaRow title={`《${seriesName}》系列`} items={relatedMedia} type="series" />;
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
    getMediaById(id),
    getSeasonsBySeriesId(id),
  ]);
  if (!series) notFound();

  const episodeYears = seasons.flatMap((season) => season.releaseYearRange?.match(/\d{4}/g) ?? []);
  const firstEpisodeYear = episodeYears.length > 0 ? Math.min(...episodeYears.map(Number)) : null;
  const lastEpisodeYear = episodeYears.length > 0 ? Math.max(...episodeYears.map(Number)) : null;
  const releaseYearRange = firstEpisodeYear !== null && lastEpisodeYear !== null
    ? (firstEpisodeYear === lastEpisodeYear ? String(firstEpisodeYear) : `${firstEpisodeYear} - ${lastEpisodeYear}`)
    : series.date?.slice(0, 4) ?? "";

  return (
    <div className="relative min-h-screen text-white/90 selection:bg-red-500/30 selection:text-white font-sans overflow-hidden">
      <MediaInformation
        media={series}
        seasons={seasons}
        backHref={returnToSearch ? query.from : undefined}
        backLabel={returnToSearch ? "返回搜索页" : undefined}
        releaseDateLabel={releaseYearRange}
        relatedContent={series.series ? (
          <Suspense fallback={<RelatedMediaLoadingSkeleton />}>
            <RelatedSeries seriesName={series.series} currentId={series.id} />
          </Suspense>
        ) : null}
      />
    </div>
  );
}
