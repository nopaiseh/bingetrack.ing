import "server-only";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import { isMediaId } from "@/lib/functions/media-id";
import { withRetry } from "@/lib/functions/retry";
import { MediaRepositoryError } from "@/lib/functions/media-repo";
import { mapViewRowToMedia } from "@/lib/functions/media-mapper";
import type { OwnershipStatus } from "@/lib/album-display";
import type { AlbumDetail, AlbumTrack } from "@/lib/types/album";
import type { ViewAllMediaRow } from "@/lib/types";
import { reportHandledError } from "@/lib/report-error";

export type { OwnershipStatus } from "@/lib/album-display";
export type { AlbumDetail, AlbumTrack } from "@/lib/types/album";
export { formatTrackDuration, ownershipLabel } from "@/lib/album-display";

type MusicAlbumRow = {
  track_count: number | null;
  label: string | null;
};

type OwnershipRow = {
  status: OwnershipStatus;
};

type TrackJoinRow = {
  media_item_id: string;
  track_number: number | null;
  media:
    | {
        id: string;
        title: string | null;
        runtime: number | null;
        tracking: { status: string | null; rating: number | null } | Array<{ status: string | null; rating: number | null }> | null;
      }
    | Array<{
        id: string;
        title: string | null;
        runtime: number | null;
        tracking: { status: string | null; rating: number | null } | Array<{ status: string | null; rating: number | null }> | null;
      }>
    | null;
};

type CreditJoinRow = {
  media_item_id: string;
  role: string;
  credit_order: number | null;
  people: { name: string | null } | Array<{ name: string | null }> | null;
};

function firstRelated<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

function personName(people: CreditJoinRow["people"]): string | null {
  const person = firstRelated(people);
  const name = person?.name?.trim();
  return name ? name : null;
}

/**
 * 读取专辑详情：v_all_media 元数据 + music_albums 字段 + ownership + 曲目与 credits。
 * 只读既有表／视图，不新增 RPC。找不到或非专辑返回 null。
 */
export async function getAlbumDetail(id: string): Promise<AlbumDetail | null> {
  if (!isMediaId(id)) return null;

  return withRetry(async () => {
    const db = getSupabasePublicServer();

    const [viewResult, albumMetaResult, ownershipResult, tracksResult] = await Promise.all([
      db.from("v_all_media").select("*").eq("id", id).maybeSingle(),
      db.from("music_albums").select("track_count,label").eq("media_item_id", id).maybeSingle(),
      db.from("ownership").select("status").eq("media_item_id", id).maybeSingle(),
      db
        .from("music")
        .select(
          "media_item_id,track_number,media:media_items!music_media_item_id_fkey(id,title,runtime,tracking(status,rating))",
        )
        .eq("album_id", id)
        .order("track_number", { ascending: true, nullsFirst: false })
        .order("media_item_id", { ascending: true }),
    ]);

    if (viewResult.error) {
      console.error(`Failed to fetch album view for ${id}:`, viewResult.error);
      throw new MediaRepositoryError("fetch album view", viewResult.error);
    }
    if (!viewResult.data) return null;
    if (String(viewResult.data.type) !== "album") return null;

    if (albumMetaResult.error) {
      console.error(`Failed to fetch music_albums for ${id}:`, albumMetaResult.error);
      throw new MediaRepositoryError("fetch album meta", albumMetaResult.error);
    }
    if (ownershipResult.error) {
      reportHandledError(`Failed to fetch ownership for album ${id}:`, ownershipResult.error);
    }
    if (tracksResult.error) {
      console.error(`Failed to fetch album tracks for ${id}:`, tracksResult.error);
      throw new MediaRepositoryError("fetch album tracks", tracksResult.error);
    }

    const media = mapViewRowToMedia(viewResult.data as ViewAllMediaRow, null, "albums");
    const artists = media.artists ?? [];
    const albumMeta = albumMetaResult.data as MusicAlbumRow | null;
    const ownership = (ownershipResult.data as OwnershipRow | null)?.status ?? null;

    const trackRows = (tracksResult.data ?? []) as TrackJoinRow[];
    const trackIds = trackRows.map((row) => row.media_item_id);

    const creditsByTrack = new Map<string, { singers: string[]; lyricists: string[]; composers: string[] }>();
    for (const trackId of trackIds) {
      creditsByTrack.set(trackId, { singers: [], lyricists: [], composers: [] });
    }

    if (trackIds.length > 0) {
      const { data: creditData, error: creditError } = await db
        .from("media_credits")
        .select("media_item_id,role,credit_order,people(name)")
        .in("media_item_id", trackIds)
        .in("role", ["artist", "lyricist", "composer"])
        .order("credit_order", { ascending: true, nullsFirst: false });

      if (creditError) {
        reportHandledError(`Failed to fetch track credits for album ${id}:`, creditError);
      } else {
        for (const row of (creditData ?? []) as CreditJoinRow[]) {
          const bucket = creditsByTrack.get(row.media_item_id);
          const name = personName(row.people);
          if (!bucket || !name) continue;
          if (row.role === "artist") bucket.singers.push(name);
          else if (row.role === "lyricist") bucket.lyricists.push(name);
          else if (row.role === "composer") bucket.composers.push(name);
        }
      }
    }

    let ratedCount = 0;
    const tracks: AlbumTrack[] = trackRows.map((row) => {
      const item = firstRelated(row.media);
      const tracking = firstRelated(item?.tracking);
      const rating = tracking?.rating == null ? null : Number(tracking.rating);
      if (rating != null && Number.isFinite(rating)) ratedCount += 1;
      const credits = creditsByTrack.get(row.media_item_id) ?? { singers: [], lyricists: [], composers: [] };
      return {
        id: row.media_item_id,
        trackNumber: row.track_number,
        title: (item?.title ?? "").trim() || "未命名曲目",
        singers: credits.singers,
        lyricists: credits.lyricists,
        composers: credits.composers,
        durationSeconds: item?.runtime == null ? null : Number(item.runtime),
        status: tracking?.status ?? null,
        rating,
      };
    });

    return {
      media,
      artists,
      trackCount: albumMeta?.track_count == null ? tracks.length || null : Number(albumMeta.track_count),
      label: albumMeta?.label?.trim() || null,
      ratedCount,
      ownership,
      tracks,
    };
  });
}
