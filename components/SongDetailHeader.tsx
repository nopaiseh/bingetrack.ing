import Image from "next/image";
import { Suspense } from "react";
import { BackLink } from "@/components/MediaBackLink";
import ClampedCopy from "@/components/ClampedCopy";
import LetterTile from "@/components/LetterTile";
import SearchTag from "@/components/SearchTag";
import SongBackLink from "@/components/SongBackLink";
import { alternateTitleLabel } from "@/lib/alternate-title-label";
import type { SongDetail } from "@/lib/types/song";

function SquarePoster({ title, coverUrl }: { title: string; coverUrl: string | null }) {
  return (
    <div
      data-poster
      className="relative aspect-square w-full overflow-hidden rounded-xl shadow-[0_12px_30px_-16px_rgba(0,0,0,0.8)]"
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes="(max-width: 639px) 64px, 96px"
          className="object-cover"
          preload
          fetchPriority="high"
        />
      ) : (
        <LetterTile title={title} decorative />
      )}
    </div>
  );
}

/** 歌曲详情页头：小方封面／字块、标题、又名／原名、类型与语言芯片；有简介则短截断。 */
export default function SongDetailHeader({ song }: { song: SongDetail }) {
  const alternate = song.alternate_title && song.alternate_title !== song.title ? song.alternate_title : null;
  const altLabel = alternateTitleLabel({ languages: song.languages });
  const genres = song.genres ?? [];
  const languages = song.languages ?? [];
  const summary = song.summary?.trim() || null;

  return (
    <header>
      <Suspense fallback={<BackLink href="/albums" label="返回音乐列表" />}>
        <SongBackLink />
      </Suspense>

      <div className="flex items-start gap-4 sm:gap-5">
        <div className="w-16 shrink-0 sm:w-24">
          <SquarePoster title={song.title} coverUrl={song.cover_url} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-balance break-words text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            {song.title}
          </h1>
          {alternate ? (
            <p className="mt-1 text-sm text-fg-secondary">
              <span className="text-fg-muted">{altLabel}</span> {alternate}
            </p>
          ) : null}
          {genres.length > 0 || languages.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="类型与语言">
              {genres.map((name) => (
                <SearchTag key={`genre-${name}`} label={name} category="genre" />
              ))}
              {languages.map((name) => (
                <SearchTag key={`language-${name}`} label={name} category="language" />
              ))}
            </div>
          ) : null}
          {summary ? (
            <div className="mt-4">
              <ClampedCopy text={summary} persistClamp lines={3} expandLabel="展开 ↓" collapseLabel="收起 ↑" />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
