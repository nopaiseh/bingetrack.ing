import { notFound } from "next/navigation";
import { getMediaById, getRelatedBySeries } from "@/lib/functions/media-repo";
import { Media } from "@/lib/types";
import MediaInformation from "@/components/MediaInformation";
import MediaRow from "@/components/MediaRow";
import { RelatedMediaLoadingSkeleton } from "@/components/LoadingSkeletons";
import { Suspense } from "react";

export const revalidate = 60;

async function RelatedMovies({ seriesName, currentId }: { seriesName: string; currentId: string }) {
  const relatedMedia: Media[] = await getRelatedBySeries(seriesName, currentId);
  return <MediaRow title={`《${seriesName}》系列`} items={relatedMedia} type="movies" />;
}

export default async function MovieDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnToSearch = query.from === "/search" || query.from?.startsWith("/search?");
  const movie = await getMediaById(id);
  if (!movie) notFound();

  return (
    // Removed bg-[#060606] to let the root layout's glowing red lights shine through.
    // Updated selection color to a frosted red to match the aesthetic.
    <div className="relative min-h-screen text-white/90 selection:bg-red-500/30 selection:text-white font-sans overflow-hidden">
      <MediaInformation
        media={movie}
        seasons={null}
        backHref={returnToSearch ? query.from : undefined}
        backLabel={returnToSearch ? "返回搜索页" : undefined}
        releaseDateLabel={movie.date}
        relatedContent={movie.series ? (
          <Suspense fallback={<RelatedMediaLoadingSkeleton />}>
            <RelatedMovies seriesName={movie.series} currentId={movie.id} />
          </Suspense>
        ) : null}
      />
    </div>
  );
}
