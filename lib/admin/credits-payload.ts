import "server-only";
import type { ActorCredit, PersonRef } from "@/lib/admin/media-form";

/** 通用 credits[] 条目（admin_save_media / manage_save_media）。 */
export type CreditPayload = {
  person: { id: string } | { name: string; alternate_name?: string | null };
  role: string;
  character?: string | null;
  order: number;
};

function personObject(person: PersonRef): CreditPayload["person"] {
  if (person.id) return { id: person.id };
  return { name: person.name };
}

/** 将表单分角色列表折叠为字典驱动的 credits[]。 */
export function buildCreditsPayload(input: {
  actors?: ActorCredit[];
  directors?: PersonRef[];
  artists?: PersonRef[];
  lyricists?: PersonRef[];
  composers?: PersonRef[];
  authors?: PersonRef[];
  arrangers?: PersonRef[];
  producers?: PersonRef[];
  featured?: PersonRef[];
  writers?: PersonRef[];
  voiceActors?: ActorCredit[];
  hosts?: PersonRef[];
  guests?: PersonRef[];
}): CreditPayload[] {
  const credits: CreditPayload[] = [];
  const push = (role: string, people: PersonRef[] | ActorCredit[] | undefined, withCharacter = false) => {
    (people ?? []).forEach((person, order) => {
      const entry: CreditPayload = { person: personObject(person), role, order };
      if (withCharacter) {
        const character = "character" in person ? person.character : null;
        if (character) entry.character = character;
      }
      credits.push(entry);
    });
  };
  push("actor", input.actors, true);
  push("director", input.directors);
  push("writer", input.writers);
  push("voice_actor", input.voiceActors, true);
  push("host", input.hosts);
  push("guest", input.guests);
  push("author", input.authors);
  push("artist", input.artists);
  push("composer", input.composers);
  push("lyricist", input.lyricists);
  push("arranger", input.arrangers);
  push("producer", input.producers);
  push("featured", input.featured);
  return credits;
}

/** RPC 返回 { id, affected_person_ids }。 */
export function savedMediaId(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null && "id" in data) {
    const id = (data as { id: unknown }).id;
    return id == null ? null : String(id);
  }
  return null;
}

export function affectedPersonIds(data: unknown): string[] {
  if (data == null || typeof data !== "object" || !("affected_person_ids" in data)) return [];
  const raw = (data as { affected_person_ids: unknown }).affected_person_ids;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id)).filter(Boolean);
}
