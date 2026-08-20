import { notFound } from "next/navigation";
import { getMediaById, getRelatedBySeries } from "@/lib/functions/media-repo";
import { Media } from "@/lib/types/Media";
import MediaInformation from "@/components/MediaInformation";

export const revalidate = 60;

export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movie = await getMediaById(id, "movies");
  if (!movie) notFound();
  const relatedMedia: Media[] | null = movie.series ? await getRelatedBySeries(movie.series, movie.id, "movies") : null;

  return (
    <div className="relative bg-[#060606] text-neutral-200 selection:bg-neutral-700 selection:text-white font-sans overflow-hidden">
      
      <MediaInformation media={movie} relatedMedia={relatedMedia} seasons={null} />
    </div>
  );
}