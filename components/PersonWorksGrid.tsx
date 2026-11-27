import Image from "next/image";
import Link from "next/link";
import LetterTile from "@/components/LetterTile";
import { albumReleaseKindLabel } from "@/lib/album-display";
import { publicPathForDbType } from "@/lib/media-types";
import type { PersonRoleGroup, PersonWorkItem } from "@/lib/types/person";

function yearOf(date: string | null): string {
  return String(date ?? "").match(/\d{4}/)?.[0] ?? "";
}

function workHref(item: PersonWorkItem, personId: string): string | null {
  const path = publicPathForDbType(item.type, item.id);
  if (!path) return null;
  return `${path}?from=${encodeURIComponent(`/people/${personId}`)}`;
}

function WorkCard({ item, personId }: { item: PersonWorkItem; personId: string }) {
  const href = workHref(item, personId);
  const year = yearOf(item.release_date);
  const kindLabel = albumReleaseKindLabel(item.release_kind);
  const subtitle = [item.character, kindLabel, year].filter(Boolean).join(" · ");
  const isSquare = item.type === "album" || item.type === "music";

  const body = (
    <>
      <span className={`relative block w-full overflow-hidden rounded-lg ${isSquare ? "aspect-square" : "aspect-2/3"}`}>
        {item.cover_url ? (
          <Image src={item.cover_url} alt="" fill sizes="(max-width:640px) 33vw, 160px" className="object-cover" />
        ) : (
          <LetterTile title={item.title} decorative />
        )}
      </span>
      <span className="mt-2 block min-h-10">
        <span className="line-clamp-2 text-sm font-medium text-fg">{item.title}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-xs text-fg-muted">{subtitle}</span> : null}
      </span>
    </>
  );

  if (!href) {
    return <div className="min-w-0">{body}</div>;
  }

  return (
    <Link href={href} className="focus-ring interactive-control min-w-0 rounded-lg">
      {body}
    </Link>
  );
}

/** 人物作品封面栅格；空分组不渲染。 */
export function PersonRoleWorksSection({
  heading,
  headingId,
  groups,
  personId,
}: {
  heading: string;
  headingId: string;
  groups: readonly PersonRoleGroup[];
  personId: string;
}) {
  const visible = groups.filter((group) => group.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-6 text-xl font-semibold text-fg">
        {heading}
      </h2>
      <div className="space-y-10">
        {visible.map((group) => (
          <div key={`${heading}-${group.role}`}>
            <h3 className="mb-3 text-sm font-medium text-fg-muted">{group.label}</h3>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-4">
              {group.items.map((item) => (
                <li key={`${group.role}-${item.id}`}>
                  <WorkCard item={item} personId={personId} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
