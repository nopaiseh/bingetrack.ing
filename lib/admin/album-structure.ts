import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAlbumTrackCount } from "@/lib/album-display";
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

/** 专辑艺人（人物 ID + 姓名）；供快速加曲目预填演唱艺人。 */
export type AlbumArtistRef = {
  id: string;
  name: string;
  alternateName: string | null;
};

export type AlbumStructure = {
  album: {
    id: string;
    title: string;
    alternateTitle: string | null;
    coverUrl: string | null;
    status: WatchStatus;
    rating: number | null;
    /** 专辑关联艺人（media_credits.role=artist），按 credit_order。 */
    artists: AlbumArtistRef[];
  };
  tracks: AlbumTrackItem[];
  /** 展示用曲目数：有实际曲目用实际数，否则回退 music_albums.track_count。 */
  trackCount: number | null;
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

  const [album, summary, tracks, credits, albumMeta] = await Promise.all([
    db.from("media_items").select("id,title,alternate_title,cover_url").eq("id", albumId).maybeSingle(),
    db.from("v_all_media").select("status,rating").eq("id", albumId).maybeSingle(),
    readTracks(db, albumId),
    db
      .from("media_credits")
      .select("people(id,name,alternate_name)")
      .eq("media_item_id", albumId)
      .eq("role", "artist")
      .order("credit_order"),
    db.from("music_albums").select("track_count").eq("media_item_id", albumId).maybeSingle(),
  ]);
  if (album.error || summary.error || credits.error || albumMeta.error) throw new Error("无法读取曲目结构，请重试。");
  if (!album.data) return null;

  type CreditRow = {
    people:
      | { id: string; name: string; alternate_name: string | null }
      | { id: string; name: string; alternate_name: string | null }[]
      | null;
  };
  const artists: AlbumArtistRef[] = [];
  for (const row of (credits.data ?? []) as unknown as CreditRow[]) {
    const person = one(row.people);
    if (!person?.id || !person.name) continue;
    artists.push({
      id: person.id,
      name: person.name,
      alternateName: person.alternate_name ?? null,
    });
  }

  return {
    album: {
      id: album.data.id,
      title: album.data.title,
      alternateTitle: album.data.alternate_title ?? null,
      coverUrl: album.data.cover_url ?? null,
      status: (summary.data?.status as WatchStatus | undefined) ?? "want_to_watch",
      rating: summary.data?.rating != null ? Number(summary.data.rating) : null,
      artists,
    },
    tracks,
    trackCount: resolveAlbumTrackCount(tracks.length, albumMeta.data?.track_count),
    nextTrackNumber: Math.min(100000, (tracks.at(-1)?.number ?? 0) + 1),
  };
}
