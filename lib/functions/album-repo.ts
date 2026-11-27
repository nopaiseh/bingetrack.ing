import "server-only";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import { isMediaId } from "@/lib/functions/media-id";
import { withRetry } from "@/lib/functions/retry";
import { loadRelatedBySeries, MediaRepositoryError } from "@/lib/functions/media-repo";
import { mapViewRowToMedia } from "@/lib/functions/media-mapper";
import { resolveAlbumTrackCount, type OwnershipStatus } from "@/lib/album-display";
import type { AlbumDetail, AlbumSeriesMembership, AlbumTrack } from "@/lib/types/album";
import type { ViewAllMediaRow } from "@/lib/types";
import { reportHandledError } from "@/lib/report-error";
import type { DetailFetchResult } from "@/lib/functions/cache-degrade";
import { throwIfSeriesDegraded } from "@/lib/functions/cache-degrade";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";

export type { OwnershipStatus } from "@/lib/album-display";
export type { AlbumDetail, AlbumSeriesMembership, AlbumTrack } from "@/lib/types/album";
export { formatTrackDuration, ownershipLabel, resolveAlbumTrackCount } from "@/lib/album-display";

type SeriesMembershipRow = {
  position: number | null;
  media_series: { name: string | null } | Array<{ name: string | null }> | null;
};

type MusicAlbumRow = {
  track_count: number | null;
  label: string | null;
};

type OwnershipRow = {
  status: OwnershipStatus;
};

type TrackJoinRow = {
  song_id: string;
  disc_number: number | null;
  track_number: number | null;
  media:
    | {
        id: string;
        title: string | null;
        runtime: number | null;
        tracking:
          | { status: string | null; rating: number | null }
          | Array<{ status: string | null; rating: number | null }>
          | null;
      }
    | Array<{
        id: string;
        title: string | null;
        runtime: number | null;
        tracking:
          | { status: string | null; rating: number | null }
          | Array<{ status: string | null; rating: number | null }>
          | null;
      }>
    | null;
};

type CreditJoinRow = {
  media_item_id: string;
  role: string;
  credit_order: number | null;
  people: { name: string | null } | Array<{ name: string | null }> | null;
};

type GenreJoinRow = {
  media_item_id: string;
  genres: { name: string | null } | Array<{ name: string | null }> | null;
};

function firstRelated<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

function personName(people: CreditJoinRow["people"]): string | null {
  const person = firstRelated(people);
  const name = person?.name?.trim();
  return name ? name : null;
}

function genreName(genres: GenreJoinRow["genres"]): string | null {
  const genre = firstRelated(genres);
  const name = genre?.name?.trim();
  return name ? name : null;
}

/**
 * 读取专辑详情：v_all_media 元数据 + music_albums 字段 + ownership + 曲目与 credits + 系列。
 * 只读既有表／视图，不新增 RPC。找不到或非专辑返回 null。
 * 系列／同系列查询失败时标记 seriesDegraded（供缓存层抛 SeriesDegradedError）。
 */
export async function loadAlbumDetail(id: string): Promise<DetailFetchResult<AlbumDetail | null>> {
  if (!isMediaId(id)) return { value: null, seriesDegraded: false };

  return withRetry(async () => {
    const db = getSupabasePublicServer();
    let seriesDegraded = false;

    const [viewResult, albumMetaResult, ownershipResult, tracksResult, seriesResult] = await Promise.all([
      db.from("v_all_media").select("*").eq("id", id).maybeSingle(),
      db.from("music_albums").select("track_count,label").eq("media_item_id", id).maybeSingle(),
      db.from("ownership").select("status").eq("media_item_id", id).maybeSingle(),
      db
        .from("album_tracks")
        .select(
          "song_id,disc_number,track_number,media:media_items!album_tracks_song_id_fkey(id,title,runtime,tracking(status,rating))",
        )
        .eq("album_id", id)
        .order("disc_number", { ascending: true })
        .order("track_number", { ascending: true, nullsFirst: false })
        .order("song_id", { ascending: true }),
      // 仅依赖 album id，与视图／元数据并行；失败只上报，系列降级为空。
      db
        .from("media_item_series")
        .select("position, media_series(name)")
        .eq("media_item_id", id)
        .order("position", { ascending: true, nullsFirst: false }),
    ]);

    if (viewResult.error) {
      console.error(`Failed to fetch album view for ${id}:`, viewResult.error);
      throw new MediaRepositoryError("fetch album view", viewResult.error);
    }
    if (!viewResult.data) return { value: null, seriesDegraded: false };
    if (String(viewResult.data.type) !== "album") return { value: null, seriesDegraded: false };

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
    if (seriesResult.error) {
      reportHandledError(`Failed to fetch series memberships for album ${id}:`, seriesResult.error);
      seriesDegraded = true;
    }

    const memberships = ((seriesResult.data ?? []) as SeriesMembershipRow[]).flatMap((membership) => {
      const linkedSeries = firstRelated(membership.media_series);
      const name = linkedSeries?.name?.trim();
      if (!name) return [];
      return [
        {
          name,
          position: typeof membership.position === "number" ? membership.position : null,
        },
      ];
    });
    const seriesNames = memberships.map((membership) => membership.name);

    const media = mapViewRowToMedia(viewResult.data as ViewAllMediaRow, seriesNames, "albums");
    const artists = media.artists ?? [];
    const albumMeta = albumMetaResult.data as MusicAlbumRow | null;
    const ownership = (ownershipResult.data as OwnershipRow | null)?.status ?? null;

    const trackRows = (tracksResult.data ?? []) as TrackJoinRow[];
    const trackIds = trackRows.map((row) => row.song_id);

    const creditsByTrack = new Map<string, { singers: string[]; lyricists: string[]; composers: string[] }>();
    const genresByTrack = new Map<string, string[]>();
    for (const trackId of trackIds) {
      creditsByTrack.set(trackId, { singers: [], lyricists: [], composers: [] });
      genresByTrack.set(trackId, []);
    }

    if (trackIds.length > 0) {
      const [creditsResult, genresResult] = await Promise.all([
        // 多曲目 × 多角色可能超过 PostgREST 1000 行上限，翻页读完。
        fetchAllPages<CreditJoinRow>((from, to) =>
          db
            .from("media_credits")
            .select("media_item_id,role,credit_order,people(name)")
            .in("media_item_id", trackIds)
            .in("role", ["artist", "lyricist", "composer"])
            .order("media_item_id", { ascending: true })
            .order("credit_order", { ascending: true, nullsFirst: false })
            .order("role", { ascending: true })
            .order("person_id", { ascending: true })
            .range(from, to),
        ),
        fetchAllPages<GenreJoinRow>((from, to) =>
          db
            .from("media_genres")
            .select("media_item_id,genres(name)")
            .in("media_item_id", trackIds)
            .order("media_item_id", { ascending: true })
            .order("genre_id", { ascending: true })
            .range(from, to),
        ),
      ]);

      if (creditsResult.error) {
        reportHandledError(`Failed to fetch track credits for album ${id}:`, creditsResult.error);
      } else {
        for (const row of creditsResult.data ?? []) {
          const bucket = creditsByTrack.get(row.media_item_id);
          const name = personName(row.people);
          if (!bucket || !name) continue;
          if (row.role === "artist") bucket.singers.push(name);
          else if (row.role === "lyricist") bucket.lyricists.push(name);
          else if (row.role === "composer") bucket.composers.push(name);
        }
      }

      if (genresResult.error) {
        reportHandledError(`Failed to fetch track genres for album ${id}:`, genresResult.error);
      } else {
        for (const row of genresResult.data ?? []) {
          const bucket = genresByTrack.get(row.media_item_id);
          const name = genreName(row.genres);
          if (!bucket || !name) continue;
          bucket.push(name);
        }
      }
    }

    let ratedCount = 0;
    const tracks: AlbumTrack[] = trackRows.map((row) => {
      const item = firstRelated(row.media);
      const tracking = firstRelated(item?.tracking);
      const rating = tracking?.rating == null ? null : Number(tracking.rating);
      if (rating != null && Number.isFinite(rating)) ratedCount += 1;
      const credits = creditsByTrack.get(row.song_id) ?? { singers: [], lyricists: [], composers: [] };
      return {
        id: row.song_id,
        trackNumber: row.track_number,
        title: (item?.title ?? "").trim() || "未命名曲目",
        singers: credits.singers,
        lyricists: credits.lyricists,
        composers: credits.composers,
        genres: genresByTrack.get(row.song_id) ?? [],
        durationSeconds: item?.runtime == null ? null : Number(item.runtime),
        status: tracking?.status ?? null,
        rating,
      };
    });

    // 复用影视／图书的 loadRelatedBySeries；同系列查询失败标记 seriesDegraded。
    const relatedGroups = await Promise.all(
      memberships.map(async (membership): Promise<AlbumSeriesMembership> => {
        const related = await loadRelatedBySeries(membership.name, id);
        if (related.seriesDegraded) seriesDegraded = true;
        return {
          name: membership.name,
          position: membership.position,
          items: related.value,
        };
      }),
    );

    return {
      value: {
        media,
        artists,
        trackCount: resolveAlbumTrackCount(tracks.length, albumMeta?.track_count),
        label: albumMeta?.label?.trim() || null,
        ratedCount,
        ownership,
        tracks,
        series: relatedGroups,
      },
      seriesDegraded,
    };
  });
}

/** 公开读取；系列降级时仍返回空系列。 */
export async function getAlbumDetail(id: string): Promise<AlbumDetail | null> {
  return (await loadAlbumDetail(id)).value;
}

/** 供 unstable_cache：系列降级时抛 SeriesDegradedError，避免写入空系列。 */
export async function getAlbumDetailForCache(id: string): Promise<AlbumDetail | null> {
  return throwIfSeriesDegraded(await loadAlbumDetail(id));
}
