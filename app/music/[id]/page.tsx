import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SongAlbumsSection from "@/components/SongAlbumsSection";
import SongCreditsSection from "@/components/SongCreditsSection";
import SongDetailHeader from "@/components/SongDetailHeader";
import SongRelatedSection from "@/components/SongRelatedSection";
import { getCachedSongDetail } from "@/lib/functions/cached-media";
import { mediaDefaultDescription } from "@/lib/media-types";
import { SITE_URL } from "@/lib/site";
import { tmdbImageUrl } from "@/lib/tmdb-image";

// 按需生成；只靠保存时的 revalidateTag 失效，不定时重建。
export const revalidate = false;

/** 构建时不枚举歌曲 ID，访问时按需生成。 */
export function generateStaticParams() {
  return [];
}

/** 用缓存的歌曲详情生成元数据。 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const song = await getCachedSongDetail(id);
  if (!song) return { title: "歌曲未找到" };
  const description = mediaDefaultDescription(song.title, "music");
  const cover = song.cover_url ? tmdbImageUrl(song.cover_url, "w500") : undefined;
  return {
    title: song.title,
    description,
    openGraph: {
      title: song.title,
      description,
      url: `${SITE_URL}/music/${song.id}`,
      type: "music.song",
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
  };
}

/** 歌曲详情：页头 + 演职 + 收录于／同专曲目 + 相关歌曲。无短评。 */
export default async function SongDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const song = await getCachedSongDetail(id);
  if (!song) notFound();

  return (
    <div className="relative text-fg selection:bg-[var(--accent-soft)] selection:text-white font-sans">
      <SongDetailHeader song={song} />
      <div className="container mx-auto max-w-7xl px-4 pb-8 sm:px-6 md:pb-12 lg:px-8">
        <SongCreditsSection credits={song.credits} currentSongId={song.id} />
        <SongAlbumsSection albums={song.albums} currentSongId={song.id} />
        <SongRelatedSection related={song.related} currentSongId={song.id} />
      </div>
    </div>
  );
}
