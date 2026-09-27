import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { roleLabel, type RelatedMedia } from "@/lib/admin/credits";
import { mediaTypes } from "@/lib/admin/media-form";
import { formatRuntime } from "@/lib/format-runtime";

/** 关联作品卡片：封面、所属节目、上映日期与片长，人物另显示合并后的职务与角色。 */
export default function RelatedWork({ media, roles, characters, children }: { media: RelatedMedia; roles?: string[]; characters?: string[]; children?: ReactNode }) {
  const context = media.tv_seasons ? `${media.tv_seasons.parent?.title ?? "未知电视节目"} · 第 ${media.tv_seasons.season_number} 季`
    : media.tv_episodes ? `${media.tv_episodes.parent?.series?.title ?? "未知电视节目"} · 第 ${media.tv_episodes.parent?.season_number ?? "?"} 季 · 第 ${media.tv_episodes.episode_number} 集` : null;
  const facts = [(mediaTypes as Record<string, string>)[media.type] ?? media.type, context, media.release_date ?? "未定上映日期", formatRuntime(media.runtime == null ? null : Number(media.runtime))].filter(Boolean);
  return <article className="surface-panel space-y-3 rounded-2xl p-4">
    <div className="flex min-w-0 items-start gap-4">
      {media.cover_url ? <Image src={media.cover_url} alt="" width={44} height={66} className="h-16 w-11 shrink-0 rounded-md object-cover" /> : <span className="surface-muted h-16 w-11 shrink-0 rounded-md" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <Link href={`/manage/media/${media.id}`} className="block break-words font-medium text-white hover:text-[var(--accent-hover)]">{media.title} →</Link>
        {media.alternate_title && <p className="break-words text-xs text-neutral-400">{media.alternate_title}</p>}
        <p className="mt-1 text-sm text-neutral-400">{facts.join(" · ")}</p>
        {roles && roles.length > 0 && <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-300"><span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs">{roles.map(roleLabel).join("、")}</span>{characters && characters.length > 0 && <span className="text-neutral-400">饰 {characters.join("、")}</span>}</p>}
      </div>
    </div>
    {children}
  </article>;
}
