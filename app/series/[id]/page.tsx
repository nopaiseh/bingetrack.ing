import { notFound } from "next/navigation";
import { getMedia } from "@/lib/functions/GetMedia";
import MediaInformation from "@/components/MediaInformation";

export const revalidate = 60;

export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getMedia(id, "series");
  if (!series) notFound();

  console.log(series);
  return (
    <div className="relative bg-[#060606] text-neutral-200 selection:bg-neutral-700 selection:text-white font-sans overflow-hidden">
      {/* 页面内容容器 */}
      <MediaInformation media={series} relatedMedia={[]}/>
    </div>
  );
}