"use client";
import { useActionState } from "react";
import { deleteUnused } from "../report-actions";

/** 批量删除闲置资料；须输入当前数量确认，服务端再核对一次。 */
export default function BulkDelete({ report, count, unit }: { report: string; count: number; unit: string }) {
  const [state, action, pending] = useActionState(deleteUnused, {});
  return <section aria-labelledby="bulk-delete-title" className="mt-8 space-y-4 rounded-2xl border border-red-400/30 bg-red-900/15 p-5 sm:p-6">
    <h2 id="bulk-delete-title" className="flex items-center gap-2.5 text-base font-semibold text-red-200"><span className="i-material-symbols-warning-rounded size-5" aria-hidden="true" />全部删除</h2>
    <p className="text-sm leading-6 text-neutral-300">将永久删除全部 <span className="font-mono">{count}</span> {unit}，包括不在当前页的项目。它们没有关联任何作品，删除不影响影视与观看记录。此操作无法撤销。</p>
    <form action={action} className="space-y-4">
      <input type="hidden" name="report" value={report} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-72">输入数量 {count} 以确认删除<input name="confirm_count" required inputMode="numeric" disabled={pending} autoComplete="off" className="font-mono" /></label>
        <button disabled={pending} className="admin-danger">{pending ? "正在删除…" : "永久删除"}</button>
      </div>
      <p role="alert" className="text-sm text-red-300">{state.error}</p>
    </form>
  </section>;
}
