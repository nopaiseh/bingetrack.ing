import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManagedMediaType } from "./media-form";
import type { WatchStatus } from "./series-structure";
import { one } from "./series-structure";

export type AlbumTrackItem = {
  id: string;
  number: number;
  title: string;
  durationSeconds: number | null;
  listened: boolean;
};

export type AlbumStructure = {
  album: {
    id: string;
    title: string;
    alternateTitle: string | null;
    coverUrl: string | null;
    status: WatchStatus;
    rating: number | null;
  };
  tracks: AlbumTrackItem[];
  nextTrackNumber: number;
};

const TRACK_CHUNK = 1000;

/** 分块读取专辑曲目；失败即抛错，不把空结果当成真实结构。 */
async function readTracks(db: SupabaseClient, albumId: string): Promise<AlbumTrackItem[]> {
  type Row = {
    media_item_id: string;
    track_number: number;
    media:
      | {
          title: string;
          runtime: number | string | null;
          tracking: { status: string } | { status: string }[] | null;
        }
      | {
          title: string;
          runtime: number | string | null;
          tracking: { status: string } | { status: string }[] | null;
        }[]
      | null;
  };
  const tracks: AlbumTrackItem[] = [];
  for (let offset = 0; ; offset += TRACK_CHUNK) {
    const { data, error } = await db
      .from("music")
      .select("media_item_id,track_number,media:media_items!music_media_item_id_fkey(title,runtime,tracking(status))")
      .eq("album_id", albumId)
      .order("track_number")
      .order("media_item_id")
      .range(offset, offset + TRACK_CHUNK - 1);
    if (error) throw new Error("无法读取曲目结构，请重试。");
    for (const row of data as unknown as Row[]) {
      const media = one(row.media);
      tracks.push({
        id: row.media_item_id,
        number: Number(row.track_number),
        title: media?.title ?? "",
        durationSeconds: media?.runtime != null ? Number(media.runtime) : null,
        listened: one(media?.tracking)?.status === "watched",
      });
    }
    if ((data?.length ?? 0) < TRACK_CHUNK) return tracks;
  }
}

/**
 * 读取专辑曲目结构，供编辑页侧栏浏览与就地新增。
 * 仅 album／music 返回结构；其他类型返回 null。
 */
export async function readAlbumStructure(
  db: SupabaseClient,
  item: { id: string; type: ManagedMediaType; parent_id: string | null },
): Promise<AlbumStructure | null> {
  if (item.type !== "album" && item.type !== "music") return null;
  const albumId = item.type === "album" ? item.id : item.parent_id;
  if (!albumId) return null;

  const [album, summary, tracks] = await Promise.all([
    db.from("media_items").select("id,title,alternate_title,cover_url").eq("id", albumId).maybeSingle(),
    db.from("v_all_media").select("status,rating").eq("id", albumId).maybeSingle(),
    readTracks(db, albumId),
  ]);
  if (album.error || summary.error) throw new Error("无法读取曲目结构，请重试。");
  if (!album.data) return null;

  return {
    album: {
      id: album.data.id,
      title: album.data.title,
      alternateTitle: album.data.alternate_title ?? null,
      coverUrl: album.data.cover_url ?? null,
      status: (summary.data?.status as WatchStatus | undefined) ?? "want_to_watch",
      rating: summary.data?.rating != null ? Number(summary.data.rating) : null,
    },
    tracks,
    nextTrackNumber: Math.min(100000, (tracks.at(-1)?.number ?? 0) + 1),
  };
}
