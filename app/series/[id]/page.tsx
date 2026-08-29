import { notFound } from "next/navigation";
import { getMediaById, getRelatedBySeries } from "@/lib/functions/media-repo";
import MediaInformation from "@/components/MediaInformation";
import { Media } from "@/lib/types";
import MediaRow from "@/components/MediaRow";
import { RelatedMediaLoadingSkeleton } from "@/components/LoadingSkeletons";
import { Suspense } from "react";

export const revalidate = 60;

async function RelatedSeries({ seriesName, currentId }: { seriesName: string; currentId: string }) {
  const relatedMedia: Media[] = await getRelatedBySeries(seriesName, currentId);
  return <MediaRow title={`《${seriesName}》系列其他作品`} items={relatedMedia} type="series" />;
}

export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getMediaById(id);
  if (!series) notFound();
  const seasons = [
    { id: 1, name: "第一季", year: 2009, episodeCount: 20 },
    { id: 2, name: "第二季", year: 2011, episodeCount: 20 },
    { id: 3, name: "第三季", year: 2012, episodeCount: 24 },
    { id: 4, name: "第四季", year: 2014, episodeCount: 24 },
    { id: 5, name: "第五季", year: 2020, episodeCount: 36 },
  ];

  return (
    <div className="relative min-h-screen text-white/90 selection:bg-red-500/30 selection:text-white font-sans overflow-hidden">
      <MediaInformation
        media={series}
        seasons={seasons}
        relatedContent={series.series ? (
          <Suspense fallback={<RelatedMediaLoadingSkeleton />}>
            <RelatedSeries seriesName={series.series} currentId={series.id} />
          </Suspense>
        ) : null}
      />
    </div>
  );
}
