import Link from "next/link";
import LetterTile from "@/components/LetterTile";
import { SONG_CREDIT_SECTION_LABELS } from "@/lib/song/credit-labels";
import { publicPersonDetailPath } from "@/lib/media-types";
import type { SongCreditPerson, SongCreditRole, SongDetail } from "@/lib/types/song";

/** 方案 C 演职只展示演唱／作曲／作词三张卡。 */
const CREDIT_CARD_ROLES = ["artist", "composer", "lyricist"] as const satisfies readonly SongCreditRole[];

function PersonLinks({ people, currentSongId }: { people: readonly SongCreditPerson[]; currentSongId: string }) {
  const from = encodeURIComponent(`/music/${currentSongId}`);
  return (
    <ul className="mt-2 space-y-1">
      {people.map((person) => (
        <li key={`${person.id}-${person.name}`}>
          <Link
            href={`${publicPersonDetailPath(person.id)}?from=${from}`}
            className="focus-ring flex min-h-11 items-center gap-2.5 rounded-xl px-1 transition-colors hover:bg-[var(--surface-3)]"
          >
            <LetterTile title={person.name} avatar />
            <span className="min-w-0 truncate text-sm font-semibold text-fg">{person.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** 歌曲演职：演唱／作曲／作词三卡；人物链到公开人物页（带 from）。 */
export default function SongCreditsSection({
  credits,
  currentSongId,
}: {
  credits: SongDetail["credits"];
  currentSongId: string;
}) {
  const groups = CREDIT_CARD_ROLES.map((role) => {
    const people = credits[role] ?? [];
    if (people.length === 0) return null;
    return { role, label: SONG_CREDIT_SECTION_LABELS[role], people };
  }).filter(
    (group): group is { role: (typeof CREDIT_CARD_ROLES)[number]; label: string; people: SongCreditPerson[] } =>
      group != null,
  );

  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="song-credits-heading">
      <h2 id="song-credits-heading" className="mb-4 text-lg font-semibold text-fg">
        演职
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {groups.map(({ role, label, people }) => (
          <li key={role} className="surface-panel min-w-0 rounded-2xl p-4">
            <h3 className="text-sm font-medium text-fg-muted">{label}</h3>
            <PersonLinks people={people} currentSongId={currentSongId} />
          </li>
        ))}
      </ul>
    </section>
  );
}
