import Image from "next/image";
import Link from "next/link";
import { roleLabel, type RelatedMedia } from "@/lib/admin/credits";

/** 关联作品按年表逐行排列：年份、封面、标题与所属节目、角色。同一年的连续作品只在第一行显示年份。
 * 演员没填角色名时显示「未填角色」，方便在这里发现缺漏；showRoles 只在人物兼任多种职务时开启，避免每行重复「演员」。 */
export default function FilmographyRow({ media, roles = [], characters = [], showYear, showRoles }: { media: RelatedMedia; roles?: string[]; characters?: string[]; showYear: boolean; showRoles?: boolean }) {
  const context = media.tv_seasons ? `${media.tv_seasons.parent?.title ?? "未知电视节目"} · 第 ${media.tv_seasons.season_number} 季`
    : media.tv_episodes ? `${media.tv_episodes.parent?.series?.title ?? "未知电视节目"} · 第 ${media.tv_episodes.parent?.season_number ?? "?"} 季 · 第 ${media.tv_episodes.episode_number} 集` : null;
  const character = characters.length > 0 ? <span className="text-neutral-300">饰 {characters.join("、")}</span>
    : roles.includes("actor") ? <span className="surface-muted rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-neutral-400">未填角色</span> : null;
  const roleText = showRoles && roles.length > 0 ? <span className="text-xs text-neutral-400">{roles.map(roleLabel).join("、")}</span> : null;
  return <li className="group relative grid grid-cols-[3rem_2rem_minmax(0,1fr)] items-center gap-x-4 px-4 py-3 transition-colors hover:bg-white/5 sm:grid-cols-[3.5rem_2rem_minmax(0,1fr)_minmax(0,14rem)] sm:px-5">
    <span className="font-mono text-base text-white" title={media.release_date ?? undefined}>{showYear ? media.release_date?.slice(0, 4) ?? "—" : ""}</span>
    {media.cover_url ? <Image src={media.cover_url} alt="" width={32} height={48} className="h-12 w-8 rounded object-cover" /> : <span className="surface-muted h-12 w-8 rounded" aria-hidden="true" />}
    <div className="min-w-0">
      <Link href={`/manage/media/${media.id}`} className="block break-words font-medium text-white transition-colors after:absolute after:inset-0 group-hover:text-[var(--accent-hover)]">{media.title}</Link>
      {(media.alternate_title || context) && <p className="break-words text-xs text-neutral-400">{[media.alternate_title, context].filter(Boolean).join(" · ")}</p>}
      {(character || roleText) && <p className="mt-1 flex flex-wrap items-center gap-2 text-sm sm:hidden">{roleText}{character}</p>}
    </div>
    <p className="hidden min-w-0 flex-col items-end gap-1 break-words text-right text-sm sm:flex">{roleText}{character}</p>
  </li>;
}
