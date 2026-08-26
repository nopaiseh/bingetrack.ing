import { notFound } from "next/navigation";
import { getMediaById, getRelatedBySeries } from "@/lib/functions/media-repo";
import { Media } from "@/lib/types";
import MediaInformation from "@/components/MediaInformation";

export const revalidate = 60;

export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movie = await getMediaById(id);
  if (!movie) notFound();
  const relatedMedia: Media[] | null = movie.series ? await getRelatedBySeries(movie.series, movie.id) : null;

  return (
    // Removed bg-[#060606] to let the root layout's glowing red lights shine through.
    // Updated selection color to a frosted red to match the aesthetic.
    <div className="relative min-h-screen text-white/90 selection:bg-red-500/30 selection:text-white font-sans overflow-hidden">
      <MediaInformation media={movie} relatedMedia={relatedMedia} seasons={null} />
    </div>
  );
}