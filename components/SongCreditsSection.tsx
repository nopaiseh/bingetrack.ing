import Link from "next/link";
import { SONG_CREDIT_ROLE_ORDER, SONG_CREDIT_SECTION_LABELS } from "@/lib/song/credit-labels";
import { publicPersonDetailPath } from "@/lib/media-types";
import type { SongCreditPerson, SongDetail } from "@/lib/types/song";

function PersonLinks({ people, currentSongId }: { people: readonly SongCreditPerson[]; currentSongId: string }) {
  const from = encodeURIComponent(`/music/${currentSongId}`);
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {people.map((person) => (
        <li key={`${person.id}-${person.name}`}>
          <Link
            href={`${publicPersonDetailPath(person.id)}?from=${from}`}
            className="focus-ring rounded text-fg-secondary underline-offset-4 hover:text-fg hover:underline"
          >
            {person.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** 歌曲演职：按角色分区，人物链到公开人物页（带 from 以便返回歌曲）。 */
export default function SongCreditsSection({
  credits,
  currentSongId,
}: {
  credits: SongDetail["credits"];
  currentSongId: string;
}) {
  const groups = SONG_CREDIT_ROLE_ORDER.map((role) => {
    const people = credits[role] ?? [];
    if (people.length === 0) return null;
    return { role, label: SONG_CREDIT_SECTION_LABELS[role], people };
  }).filter(
    (group): group is { role: (typeof SONG_CREDIT_ROLE_ORDER)[number]; label: string; people: SongCreditPerson[] } =>
      group != null,
  );

  if (groups.length === 0) return null;

  return (
    <section className="mt-10" aria-labelledby="song-credits-heading">
      <h2 id="song-credits-heading" className="mb-4 text-lg font-semibold text-fg">
        演职
      </h2>
      <dl className="space-y-4">
        {groups.map(({ role, label, people }) => (
          <div key={role} className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:items-baseline">
            <dt className="text-sm font-medium text-fg-muted">{label}</dt>
            <dd>
              <PersonLinks people={people} currentSongId={currentSongId} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
