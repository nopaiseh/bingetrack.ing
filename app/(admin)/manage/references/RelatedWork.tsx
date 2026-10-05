import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { roleLabel, type RelatedMedia } from "@/lib/admin/credits";
import { mediaTypes } from "@/lib/admin/media-form";
import { formatRuntime } from "@/lib/format-runtime";

/** 电视节目与季的日期是首播（最早一集），电影是上映，单集是播出。 */
const dateLabels: Record<string, string> = { movie: "上映", tv_show: "首播", tv_season: "首播", tv_episode: "播出" };

/** 系列作品卡片：左侧封面、标题与所属节目，右侧日期与片长，下方放排序与移除操作。 */
export default function RelatedWork({ media, roles, characters, children }: { media: RelatedMedia; roles?: string[]; characters?: string[]; children?: ReactNode }) {
  const context = media.tv_seasons ? `${media.tv_seasons.parent?.title ?? "未知电视节目"} · 第 ${media.tv_seasons.season_number} 季`
    : media.tv_episodes ? `${media.tv_episodes.parent?.series?.title ?? "未知电视节目"} · 第 ${media.tv_episodes.parent?.season_number ?? "?"} 季 · 第 ${media.tv_episodes.episode_number} 集` : null;
  const meta = [(mediaTypes as Record<string, string>)[media.type] ?? media.type, context].filter(Boolean);
  const runtime = formatRuntime(media.runtime == null ? null : Number(media.runtime));
  return <article className="surface-panel space-y-3 rounded-2xl p-4">
    <div className="flex min-w-0 items-start gap-4">
      {media.cover_url ? <Image src={media.cover_url} alt="" width={44} height={66} className="h-16 w-11 shrink-0 rounded-md object-cover" /> : <span className="surface-muted h-16 w-11 shrink-0 rounded-md" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <Link href={`/manage/media/${media.id}`} className="block break-words font-medium text-white hover:text-[var(--accent-hover)]">{media.title} →</Link>
        {media.alternate_title && <p className="break-words text-xs text-neutral-400">{media.alternate_title}</p>}
        {meta.length > 0 && <p className="mt-1 text-sm text-neutral-400">{meta.join(" · ")}</p>}
        {roles && roles.length > 0 && <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-300"><span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs">{roles.map(roleLabel).join("、")}</span>{characters && characters.length > 0 && <span className="text-neutral-400">饰 {characters.join("、")}</span>}</p>}
      </div>
      <dl className="shrink-0 text-right">
        <dt className="text-xs text-neutral-500">{dateLabels[media.type] ?? "日期"}</dt>
        <dd className={`font-mono text-sm ${media.release_date ? "text-neutral-200" : "text-neutral-500"}`}>{media.release_date ?? "待定"}</dd>
        {runtime && <dd className="mt-1 font-mono text-xs text-neutral-400">{runtime}</dd>}
      </dl>
    </div>
    {children}
  </article>;
}
