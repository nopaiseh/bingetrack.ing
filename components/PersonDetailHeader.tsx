import Image from "next/image";
import { Suspense } from "react";
import { BackLink } from "@/components/MediaBackLink";
import LetterTile from "@/components/LetterTile";
import type { PersonDetail } from "@/lib/types/person";
import PersonBackLink from "@/components/PersonBackLink";

/** 人物页头：姓名 + 头像（无则字块）。people 表暂无头像列。 */
export default function PersonDetailHeader({ person }: { person: PersonDetail }) {
  const alternate = person.alternate_name && person.alternate_name !== person.name ? person.alternate_name : null;

  return (
    <header className="container mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 lg:px-8">
      <Suspense fallback={<BackLink href="/search" label="返回搜索页" />}>
        <PersonBackLink />
      </Suspense>

      <div className="flex items-center gap-4 sm:gap-5">
        <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-full sm:w-24">
          {person.photo_url ? (
            <Image
              src={person.photo_url}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
              preload
              fetchPriority="high"
            />
          ) : (
            <LetterTile title={person.name} avatar className="!size-full !rounded-full" decorative />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-balance break-words text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            {person.name}
          </h1>
          {alternate ? <p className="mt-1 text-sm text-fg-secondary">{alternate}</p> : null}
        </div>
      </div>
    </header>
  );
}
