import Link from "next/link";
import { requireOwner } from "@/lib/auth/server";
import { reportGroups, reports } from "@/lib/admin/reports";
import { readReportCounts } from "@/lib/admin/overview";

/** 报告概览：并行统计各报告数量，数量为零的报告显示为已清理。 */
export default async function ReportsPage() {
  const { db } = await requireOwner();
  const counts = await readReportCounts(db);
  const pending = [...counts.values()].filter(count => count).length;
  const cleared = [...counts.values()].filter(count => count === 0).length;
  return <section>
    <div className="surface-panel mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 sm:p-8">
      <div>
        <h1 className="admin-heading">数据报告</h1>
        <p className="mt-2 text-neutral-400">找出缺漏、闲置与可疑的资料 · 点击条目直接前往修改</p>
      </div>
      <p className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-[var(--accent-light)]"><span className="font-mono">{pending}</span> 份待处理</span>
        <span className="surface-muted rounded-full border border-white/10 px-3 py-1 text-neutral-300"><span className="font-mono">{cleared}</span> 份已清理</span>
      </p>
    </div>
    <div className="space-y-8">{reportGroups().map(/* 与导航分组一致。 */ group => <div key={group.label}>
      <h2 className="mb-3 px-1 text-sm font-medium tracking-wider text-fg-subtle">{group.label}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">{group.kinds.map(/* 每份报告一张卡片。 */ kind => {
        const config = reports[kind];
        const count = counts.get(kind);
        return <li key={kind}>
          <Link href={`/manage/reports/${kind}`} className={`surface-panel group flex h-full items-start gap-4 rounded-2xl p-5 transition-colors hover:bg-white/5 ${count === 0 ? "opacity-75" : ""}`}>
            <span className={`${config.icon} mt-0.5 size-6 shrink-0 inline-block ${count === 0 ? "text-neutral-400" : "text-[var(--accent)]"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-medium text-white transition-colors group-hover:text-[var(--accent-hover)]">{config.label}</h3>
                <span className={`inline-flex shrink-0 items-center gap-1 font-mono text-sm ${count == null ? "text-red-300" : count ? "text-[var(--accent-light)]" : "text-neutral-400"}`}>{count === 0 && <span className="i-material-symbols-check-rounded size-4" aria-hidden="true" />}{count == null ? "读取失败" : count ? `${count.toLocaleString("en-US")} ${config.unit}` : "已清理"}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-neutral-400">{config.description}</p>
            </div>
          </Link>
        </li>;
      })}</ul>
    </div>)}</div>
  </section>;
}
