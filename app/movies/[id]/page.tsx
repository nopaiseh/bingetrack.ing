import { notFound } from "next/navigation";
import { getRelatedBySeries } from "@/lib/functions/media-repo";
import MediaInformation from "@/components/MediaInformation";
import MediaRow from "@/components/MediaRow";
import { RelatedMediaLoadingSkeleton } from "@/components/LoadingSkeletons";
import { Suspense } from "react";
import { getCachedMediaById } from "@/lib/functions/cached-media";
import type { Metadata } from "next";
import { buildMediaJsonLd, buildMediaMetadata, serializeJsonLd } from "@/lib/seo/media";

export const revalidate = 60;

// Generate public detail pages on demand and reuse them for 60 seconds.
export function generateStaticParams() { return []; }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const movie = await getCachedMediaById(id);
  if (!movie) return { title: "电影未找到" };
  return buildMediaMetadata(movie);
}

async function RelatedMovies({ seriesNames, currentId }: { seriesNames: string[]; currentId: string }) {
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
    // Removed bg-[#060606] to let the root layout's glowing red lights shine through.
    // Updated selection color to a frosted red to match the aesthetic.
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
