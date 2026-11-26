import { notFound } from "next/navigation";
import AlbumDetailHeader from "@/components/AlbumDetailHeader";
import AlbumTracklist from "@/components/AlbumTracklist";
import MediaRow from "@/components/MediaRow";
import { getCachedAlbumDetail } from "@/lib/functions/cached-media";
import type { AlbumSeriesMembership } from "@/lib/types/album";
import type { Metadata } from "next";
import { buildMediaJsonLd, buildMediaMetadata, serializeJsonLd } from "@/lib/seo/media";

// 按需生成；只靠保存时的 revalidateTag 失效，不定时重建。
export const revalidate = false;

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

/**
 * 同系列其他专辑：数据已在 getAlbumDetail.series 里（不含当前）。
 * 空系列或 items 为空时不渲染；开启「第 N 部」角标（缺 seriesPosition 则隐藏）。
 */
function AlbumSeriesRows({ series }: { series: readonly AlbumSeriesMembership[] }) {
  const groups = series.filter(({ items }) => items.length > 0);
  if (groups.length === 0) return null;

  return (
    <div className="mt-12 space-y-12" data-testid="album-series-section">
      {groups.map(({ name, items }) => (
        <MediaRow key={name} title={`《${name}》系列`} items={items} type="album" showSeriesPosition />
      ))}
    </div>
  );
}

/** 专辑详情：方案 C 页头 + 曲目表 + 同系列横向卡片。 */
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
        <AlbumSeriesRows series={album.series} />
      </div>
    </div>
  );
}
