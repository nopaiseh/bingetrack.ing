import Image from "next/image";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAiringShows, readLibraryCounts, readReportCounts, RECENT_DAYS, type AiringShow } from "@/lib/admin/overview";
import { reports } from "@/lib/admin/reports";
import GlobalSearch from "./GlobalSearch";
import { formatCount } from "./media/series/shared";

const REPORT_PREVIEW = 4;

/** 无法推算日期时，按原因说明，不笼统说缺少日期。 */
const noDateText = { same_day: "最近几集同一天上线，没有播出间隔可推算", missing: "最近几集没有播出日期，无法推算下一集", irregular: "播出日期倒序或间隔超过一年，不推算下一集" } as const;

/** 待录入的说明：推算日期已到的提示尚未录入，否则提示下一集何时播出。 */
function dueText(show: AiringShow) {
  if (!show.lastEpisode) return { text: `第 ${show.season} 季还没有单集`, overdue: true };
  const { releaseDate, dateBasis } = show.next;
  if (!releaseDate) return { text: noDateText[dateBasis === "same_day" || dateBasis === "irregular" ? dateBasis : "missing"], overdue: false };
  const how = dateBasis === "single" ? "按每周推算" : "按间隔推算";
  const date = releaseDate.slice(5);
  return show.overdue ? { text: `${how} ${date} 已播出，尚未录入`, overdue: true } : { text: `${how} ${date} 播出下一集`, overdue: false };
}

/** 管理首页：全局搜索、待录入的节目与待处理的报告，登录后先看到需要做的事。 */
export default async function Overview({ db }: { db: SupabaseClient }) {
  const today = new Date().toISOString().slice(0, 10);
  const [counts, airing, reportCounts] = await Promise.all([readLibraryCounts(db), readAiringShows(db, today), readReportCounts(db)]);
  const pending = [...reportCounts].flatMap(([kind, count]) => (count ? [{ kind, count }] : [])).sort((a, b) => b.count - a.count);

  return <section className="space-y-6">
    <div className="surface-panel flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 sm:p-8">
      <div>
        <h1 className="admin-heading">管理概览</h1>
        <p className="mt-2 font-mono text-sm text-neutral-400">电影 {formatCount(counts.movie)} · 电视节目 {formatCount(counts.tv_show)} · 单集 {formatCount(counts.tv_episode)} · 人物 {formatCount(counts.people)}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/manage/media/new?type=tv_show" className="admin-button"><span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />新增电视节目</Link>
        <Link href="/manage/media/new?type=movie" className="admin-button admin-primary"><span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />新增电影</Link>
      </div>
    </div>

    <GlobalSearch />

    {/* 单列也要写明 grid-cols-1：隐式列按内容最小宽度撑开，不换行的标题会把卡片顶出手机屏幕。 */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start">
      <section aria-labelledby="airing-title" className="surface-panel rounded-2xl p-5 pb-3">
        <div className="mb-1 flex items-baseline justify-between gap-3"><h2 id="airing-title" className="admin-section-title text-base font-medium text-white">待录入</h2><span className="text-xs text-neutral-400">最近 {RECENT_DAYS} 天有播出的节目</span></div>
        {airing.length ? <ul>{airing.map(show => {
          const due = dueText(show);
          const addSeason = show.season == null;
          return <li key={show.id} className="flex items-center gap-3.5 border-t border-white/[0.07] px-1 py-3 first:border-t-0 sm:px-2">
            {show.coverUrl ? <Image src={show.coverUrl} alt="" width={36} height={54} className="h-[54px] w-9 shrink-0 rounded-md object-cover" /> : <span className="surface-muted h-[54px] w-9 shrink-0 rounded-md border border-white/10" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <Link href={`/manage/media/${show.id}?type=tv_show`} className="block truncate font-medium text-white hover:text-[var(--accent-hover)]">{show.title}</Link>
              <p className="mt-0.5 font-mono text-xs text-neutral-400">最近播出 {show.lastAired}{show.lastEpisode && show.season != null ? ` · 已录入到 S${show.season}E${show.lastEpisode.number}` : ""}</p>
              <p className={`mt-0.5 font-mono text-xs ${due.overdue ? "text-[var(--accent-light)]" : "text-neutral-400"}`}>{due.text}</p>
            </div>
            <Link href={`/manage/media/${show.id}?type=tv_show&add=${addSeason ? "season" : "episode"}`} aria-label={`为${show.title}新增第 ${addSeason ? 1 : show.next.number} ${addSeason ? "季" : "集"}`} className="admin-button admin-add shrink-0 whitespace-nowrap">
              <span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />第 {formatCount(addSeason ? 1 : show.next.number)} {addSeason ? "季" : "集"}
            </Link>
          </li>;
        })}</ul> : <p className="py-6 text-sm text-neutral-400">最近 {RECENT_DAYS} 天没有播出的节目。</p>}
      </section>

      <section aria-labelledby="reports-title" className="surface-panel space-y-2.5 rounded-2xl p-5">
        <div className="flex items-baseline justify-between gap-3"><h2 id="reports-title" className="admin-section-title text-base font-medium text-white">数据报告</h2><span className={`font-mono text-xs ${pending.length ? "text-[var(--accent-light)]" : "text-neutral-400"}`}>{pending.length ? `${pending.length} 份待处理` : "全部已清理"}</span></div>
        {pending.slice(0, REPORT_PREVIEW).map(({ kind, count }) => <Link key={kind} href={`/manage/reports/${kind}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-sm transition-colors hover:bg-white/[0.06]">
          <span className="text-neutral-100">{reports[kind].label}</span>
          <span className="whitespace-nowrap font-mono text-[13px] text-[var(--accent-light)]">{formatCount(count)} {reports[kind].unit}</span>
        </Link>)}
        {!pending.length && <p className="py-3 text-sm text-neutral-400">没有需要处理的资料。</p>}
        <Link href="/manage/reports" className="inline-block px-0.5 pt-1 text-sm text-neutral-300 hover:text-white">查看全部报告 →</Link>
      </section>
    </div>
  </section>;
}
