import Link from "next/link";
import { requireOwner } from "@/lib/auth/server";
import { reportGroups, reports, type ReportKind } from "@/lib/admin/reports";

/** 报告概览：并行统计各报告数量，数量为零的报告显示为已清理。 */
export default async function ReportsPage() {
  const { db } = await requireOwner();
  const kinds = Object.keys(reports) as ReportKind[];
  const results = await Promise.all(kinds.map(/* 只取数量，不读取行。 */ kind => db.from(reports[kind].view).select("id", { count: "exact", head: true })));
  const counts = new Map(kinds.map((kind, index) => [kind, results[index].error ? null : results[index].count ?? 0]));
  return <section>
    <div className="surface-panel mb-8 rounded-3xl p-5 sm:p-8">
      <h1 className="admin-heading">数据报告</h1>
      <p className="mt-2 text-neutral-400">找出缺漏、闲置与可疑的资料 · 点击条目直接前往修改</p>
    </div>
    <div className="space-y-8">{reportGroups().map(/* 与导航分组一致。 */ group => <div key={group.label}>
      <h2 className="mb-3 px-1 text-sm font-medium tracking-wider text-fg-subtle">{group.label}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">{group.kinds.map(/* 每份报告一张卡片。 */ kind => {
        const config = reports[kind];
        const count = counts.get(kind);
        return <li key={kind}>
          <Link href={`/manage/reports/${kind}`} className="surface-panel group flex h-full items-start gap-4 rounded-2xl p-5 transition-colors hover:bg-white/5">
            <span className={`${config.icon} mt-0.5 size-6 shrink-0 inline-block text-[var(--accent)]`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-medium text-white transition-colors group-hover:text-[var(--accent-hover)]">{config.label}</h3>
                <span className={`shrink-0 text-sm tabular-nums ${count ? "text-[var(--accent-light)]" : "text-neutral-500"}`}>{count == null ? "读取失败" : count ? `${count} ${config.unit}` : "已清理"}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-neutral-400">{config.description}</p>
            </div>
          </Link>
        </li>;
      })}</ul>
    </div>)}</div>
  </section>;
}
