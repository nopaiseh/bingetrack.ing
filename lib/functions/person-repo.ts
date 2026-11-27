import "server-only";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import { isMediaId } from "@/lib/functions/media-id";
import type { PersonDetail, PersonRoleGroup, PersonWorkItem, PersonWorksPayload } from "@/lib/types/person";

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseWorkItem(raw: unknown): PersonWorkItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const title = asString(row.title);
  const type = asString(row.type);
  if (!id || !title || !type) return null;
  return {
    id,
    type,
    title,
    alternate_title: asString(row.alternate_title),
    cover_url: asString(row.cover_url),
    release_date: asString(row.release_date),
    character: asString(row.character),
    release_kind: asString(row.release_kind),
  };
}

function parseRoleGroup(raw: unknown): PersonRoleGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const role = asString(row.role);
  const label = asString(row.label);
  if (!role || !label) return null;
  const itemsRaw = Array.isArray(row.items) ? row.items : [];
  const items = itemsRaw.map(parseWorkItem).filter((item): item is PersonWorkItem => item != null);
  if (items.length === 0) return null;
  return { role, label, items };
}

function parseRoleGroups(raw: unknown): PersonRoleGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseRoleGroup).filter((group): group is PersonRoleGroup => group != null);
}

/** 将 get_person_works jsonb 规范为 PersonWorksPayload。 */
export function parsePersonWorks(data: unknown): PersonWorksPayload | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const personId = asString(row.person_id);
  if (!personId || !isMediaId(personId)) return null;
  const music =
    row.music && typeof row.music === "object" && !Array.isArray(row.music)
      ? (row.music as Record<string, unknown>)
      : {};
  return {
    person_id: personId,
    film_tv: parseRoleGroups(row.film_tv),
    music: {
      albums: parseRoleGroups(music.albums),
      songs: parseRoleGroups(music.songs),
    },
    books: parseRoleGroups(row.books),
  };
}

/**
 * 人物详情：people 行 + get_person_works。
 * 人物不存在（P0002）时返回 null。
 */
export async function getPersonDetail(id: string): Promise<PersonDetail | null> {
  if (!isMediaId(id)) return null;
  const db = getSupabasePublicServer();

  const personResult = await db.from("people").select("id,name,alternate_name").eq("id", id).maybeSingle();
  if (personResult.error) throw personResult.error;
  if (!personResult.data) return null;

  const { data, error } = await db.rpc("get_person_works", { p_person_id: id });
  if (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    const message = error.message ?? "";
    if (code === "P0002" || /Person not found/i.test(message)) return null;
    throw error;
  }

  const works = parsePersonWorks(data);
  if (!works) return null;

  return {
    id: String(personResult.data.id),
    name: personResult.data.name,
    alternate_name: personResult.data.alternate_name ?? null,
    photo_url: null,
    works,
  };
}

export async function getPersonDetailForCache(id: string): Promise<PersonDetail | null> {
  return getPersonDetail(id);
}
