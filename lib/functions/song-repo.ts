import "server-only";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import { isMediaId } from "@/lib/functions/media-id";
import type {
  RelatedSong,
  SongAlbumMembership,
  SongAlbumOtherTrack,
  SongCreditPerson,
  SongCreditRole,
  SongDetail,
  SongRelationRole,
  SongSeriesRef,
  SongTracking,
} from "@/lib/types/song";

const CREDIT_ROLES: readonly SongCreditRole[] = ["artist", "composer", "lyricist", "arranger", "producer", "featured"];
const RELATION_ROLES = new Set<SongRelationRole>(["artist", "composer", "lyricist"]);

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item): item is string => item != null);
}

function parsePerson(raw: unknown): SongCreditPerson | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asString(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    alternate_name: asString(row.alternate_name),
  };
}

function parseCredits(raw: unknown): SongDetail["credits"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const credits: SongDetail["credits"] = {};
  for (const role of CREDIT_ROLES) {
    const list = source[role];
    if (!Array.isArray(list)) continue;
    const people = list.map(parsePerson).filter((person): person is SongCreditPerson => person != null);
    if (people.length > 0) credits[role] = people;
  }
  return credits;
}

function parseOtherTrack(raw: unknown): SongAlbumOtherTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const title = asString(row.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    disc_number: asNumber(row.disc_number),
    track_number: asNumber(row.track_number),
    duration_seconds: asNumber(row.duration_seconds),
  };
}

function parseAlbum(raw: unknown): SongAlbumMembership | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const title = asString(row.title);
  if (!id || !title) return null;
  const otherRaw = Array.isArray(row.other_tracks) ? row.other_tracks : [];
  return {
    id,
    title,
    cover_url: asString(row.cover_url),
    release_date: asString(row.release_date),
    release_kind: asString(row.release_kind),
    disc_number: asNumber(row.disc_number),
    track_number: asNumber(row.track_number),
    other_tracks: otherRaw.map(parseOtherTrack).filter((track): track is SongAlbumOtherTrack => track != null),
  };
}

function parseRelations(raw: unknown): SongRelationRole[] {
  if (!Array.isArray(raw)) return [];
  const ordered: SongRelationRole[] = [];
  const seen = new Set<string>();
  for (const role of ["artist", "composer", "lyricist"] as const) {
    if (raw.includes(role) && !seen.has(role)) {
      seen.add(role);
      ordered.push(role);
    }
  }
  // 容忍后端偶发乱序／重复；只保留白名单。
  for (const item of raw) {
    const role = asString(item);
    if (role && RELATION_ROLES.has(role as SongRelationRole) && !seen.has(role)) {
      seen.add(role);
      ordered.push(role as SongRelationRole);
    }
  }
  return ordered;
}

function parseRelated(raw: unknown): RelatedSong | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const title = asString(row.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    cover_url: asString(row.cover_url),
    release_date: asString(row.release_date),
    relations: parseRelations(row.relations),
  };
}

function parseSeries(raw: unknown): SongSeriesRef | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asString(row.name);
  if (!id || !name) return null;
  return { id, name };
}

function parseTracking(raw: unknown): SongTracking {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    status: asString(row.status),
    rating: asNumber(row.rating),
  };
}

/** 将 RPC jsonb 规范为 SongDetail；形状不对返回 null。 */
export function parseSongDetail(data: unknown): SongDetail | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const id = asString(row.id);
  const title = asString(row.title);
  if (!id || !title || !isMediaId(id)) return null;

  const albumsRaw = Array.isArray(row.albums) ? row.albums : [];
  const relatedRaw = Array.isArray(row.related) ? row.related : [];
  const seriesRaw = Array.isArray(row.series) ? row.series : [];

  return {
    id,
    title,
    alternate_title: asString(row.alternate_title),
    duration_seconds: asNumber(row.duration_seconds),
    release_date: asString(row.release_date),
    summary: asString(row.summary),
    cover_url: asString(row.cover_url),
    genres: asStringArray(row.genres),
    languages: asStringArray(row.languages),
    series: seriesRaw.map(parseSeries).filter((item): item is SongSeriesRef => item != null),
    credits: parseCredits(row.credits),
    albums: albumsRaw.map(parseAlbum).filter((item): item is SongAlbumMembership => item != null),
    related: relatedRaw.map(parseRelated).filter((item): item is RelatedSong => item != null),
    tracking: parseTracking(row.tracking),
  };
}

/**
 * 调用 get_song_detail。
 * 歌曲不存在（P0002）时返回 null；其它错误上抛。
 */
export async function getSongDetail(id: string): Promise<SongDetail | null> {
  if (!isMediaId(id)) return null;
  const db = getSupabasePublicServer();
  const { data, error } = await db.rpc("get_song_detail", { p_song_id: id });
  if (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    const message = error.message ?? "";
    if (code === "P0002" || /Song not found/i.test(message)) return null;
    throw error;
  }
  return parseSongDetail(data);
}

/** 供 unstable_cache 使用的别名。 */
export async function getSongDetailForCache(id: string): Promise<SongDetail | null> {
  return getSongDetail(id);
}
