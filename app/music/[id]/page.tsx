import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SongAlbumsSection from "@/components/SongAlbumsSection";
import SongCreditsSection from "@/components/SongCreditsSection";
import SongDetailHeader from "@/components/SongDetailHeader";
import SongFactStrip from "@/components/SongFactStrip";
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

/** 歌曲详情方案 C：左栏页头／事实／演职／相关；右栏 sticky 专辑面板。无短评。 */
export default async function SongDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const song = await getCachedSongDetail(id);
  if (!song) notFound();

  const albumSong = { id: song.id, title: song.title, duration_seconds: song.duration_seconds };

  return (
    <div className="relative text-fg selection:bg-[var(--accent-soft)] selection:text-white font-sans">
      <div className="container mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 md:pb-12 lg:px-8">
        {/* 窄屏纵向：页头→事实→演职→专辑→相关；宽屏两列，专辑 sticky 在右。 */}
        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-10 lg:gap-y-10">
          <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-1">
            <SongDetailHeader song={song} />
            <SongFactStrip song={song} />
            <SongCreditsSection credits={song.credits} currentSongId={song.id} />
          </div>
          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start">
            <SongAlbumsSection albums={song.albums} song={albumSong} />
          </aside>
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <SongRelatedSection related={song.related} currentSongId={song.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
