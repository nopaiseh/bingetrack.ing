import { notFound } from "next/navigation";
import { getMedia } from "@/lib/functions/GetMedia";
import { getMediaList } from "@/lib/functions/GetMediaList";
import { Media } from "@/lib/types/Media";
import MediaInformation from "@/components/MediaInformation";

export const revalidate = 60;

export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movie = await getMedia(id, "movies");
  if (!movie) notFound();
  const relatedMedia: Media[] | null = movie.series ? await getMediaList({ seriesName: movie.series, currentId: movie.id, mode: "movies" }) : null;

  return (
    <div className="relative bg-[#060606] text-neutral-200 selection:bg-neutral-700 selection:text-white font-sans overflow-hidden">
      {/* 页面内容容器 */}
      <MediaInformation media={movie} relatedMedia={relatedMedia} />
    </div>
  );
}