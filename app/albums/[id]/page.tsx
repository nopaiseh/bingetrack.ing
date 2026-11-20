import { notFound } from "next/navigation";
import AlbumDetailHeader from "@/components/AlbumDetailHeader";
import AlbumTracklist from "@/components/AlbumTracklist";
import { getCachedAlbumDetail } from "@/lib/functions/cached-media";
import type { Metadata } from "next";
import { buildMediaJsonLd, buildMediaMetadata, serializeJsonLd } from "@/lib/seo/media";

export const revalidate = 86400;

/** 构建时不枚举专辑 ID，访问时按需生成。 */
export function generateStaticParams() {
  return [];
}

/** 用缓存的专辑详情生成页面与分享元数据。 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const album = await getCachedAlbumDetail(id);
  if (!album) return { title: "专辑未找到" };
  return buildMediaMetadata(album.media);
}

/** 专辑详情：方案 C 页头 + 曲目表。 */
export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = await getCachedAlbumDetail(id);
  if (!album) notFound();

  const jsonLd = buildMediaJsonLd(album.media);

  return (
    <div className="relative text-fg selection:bg-[var(--accent-soft)] selection:text-white font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <AlbumDetailHeader
        media={album.media}
        artists={album.artists}
        trackCount={album.trackCount}
        label={album.label}
        ratedCount={album.ratedCount}
        ownership={album.ownership}
      />
      <div className="container mx-auto max-w-7xl px-4 pb-8 sm:px-6 md:pb-12 lg:px-8">
        <h2 className="mb-4 text-lg font-semibold text-fg">曲目</h2>
        <AlbumTracklist tracks={album.tracks} />
      </div>
    </div>
  );
}
