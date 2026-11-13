"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { clearedHint, formatReportCount, type ReportCardModel } from "./board";

function PendingCard({ report }: { report: ReportCardModel }) {
  const countText = formatReportCount(report.count, report.unit);
  const failed = report.count == null;
  const more = report.count != null && report.count > report.previews.length;
  return (
    <li>
      <article className={`admin-report-card${failed ? " is-error" : ""}`}>
        <Link href={report.href} className="admin-report-summary">
          <span className="admin-report-icon" aria-hidden="true"><span className={`${report.icon} size-5`} /></span>
          <span className="admin-report-summary-copy">
            <h3>{report.label}</h3>
            <p className="admin-report-desc">{report.description}</p>
            <p className={`admin-report-count${failed ? " is-error" : ""}`}>{countText}</p>
          </span>
        </Link>
        <div className="admin-report-detail">
          <div className="admin-report-head">
            <span className="admin-report-icon" aria-hidden="true"><span className={`${report.icon} size-5`} /></span>
            <h3><Link href={report.href}>{report.label}</Link></h3>
            <p className={`admin-report-count${failed ? " is-error" : ""}`}>{countText}</p>
          </div>
          {report.previews.length > 0 ? (
            <ul className="admin-report-rows" aria-label={`${report.label}的前几条`}>
              {report.previews.map(row => (
                <li key={row.id}>
                  <Link href={row.href} className="admin-report-row">
                    <span className="admin-report-row-title">{row.title}</span>
                    <span className="admin-report-action">去修改 <span aria-hidden="true">→</span></span>
                    {row.detail ? <span className="admin-report-row-detail">{row.detail}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="admin-report-desc">{report.description}</p>}
          {more ? <Link href={report.href} className="admin-report-more">查看全部 {countText} <span aria-hidden="true">→</span></Link> : null}
        </div>
      </article>
    </li>
  );
}

/** 已清理的报告默认收起。按钮带 aria-expanded，展开后仍可逐条打开。 */
function ClearedReports({ reports }: { reports: ReportCardModel[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!reports.length) return null;
  const hint = clearedHint(reports.map(report => report.label));
  return (
    <section className="admin-report-cleared-section" aria-labelledby="reports-cleared-title">
      <h2 id="reports-cleared-title" className="sr-only">已清理</h2>
      <button
        type="button"
        className="admin-report-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
      >
        <span className="i-material-symbols-chevron-right-rounded admin-report-chevron size-5" aria-hidden="true" />
        <span className="admin-report-toggle-copy">
          <span className="admin-report-toggle-title">已清理 <span className="admin-report-count">{reports.length.toLocaleString("en-US")} 项</span></span>
          <span className="admin-report-toggle-hint">{open ? "点击收起" : "点击展开"} · {hint}</span>
        </span>
        <span className="admin-report-toggle-state">{open ? "已展开" : "已收起"}</span>
      </button>
      <div id={panelId} className="admin-report-cleared-panel" role="region" aria-label="已清理的报告" hidden={!open}>
        <ul className="admin-report-grid">
          {reports.map(report => (
            <li key={report.kind}>
              <Link href={report.href} className="admin-report-cleared">
                <span className={`${report.icon} admin-report-cleared-icon size-5`} aria-hidden="true" />
                <span className="admin-report-cleared-copy">
                  <span className="admin-report-cleared-title">{report.label}</span>
                  <span className="admin-report-cleared-desc">{report.description}</span>
                </span>
                <span className="admin-report-cleared-state"><span className="i-material-symbols-check-rounded size-4" aria-hidden="true" />已清理</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** 待处理在前并标出数量；已清理收在下方，默认折叠。 */
export default function ReportsBoard({ pending, cleared }: { pending: ReportCardModel[]; cleared: ReportCardModel[] }) {
  return (
    <div className="admin-report-board">
      <section aria-labelledby="reports-pending-title">
        <h2 id="reports-pending-title" className="admin-report-kicker">待处理</h2>
        {pending.length ? (
          <ul className="admin-report-grid">
            {pending.map(report => <PendingCard key={report.kind} report={report} />)}
          </ul>
        ) : <p className="admin-report-empty">没有需要处理的资料。</p>}
      </section>
      <ClearedReports reports={cleared} />
    </div>
  );
}
