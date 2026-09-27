"use client";
import { useActionState } from "react";
import { deleteUnused } from "../report-actions";

/** 批量删除闲置资料；须输入当前数量确认，服务端再核对一次。 */
export default function BulkDelete({ report, count, unit }: { report: string; count: number; unit: string }) {
  const [state, action, pending] = useActionState(deleteUnused, {});
  return <details className="mt-8 rounded-2xl border border-white/10 p-5">
    <summary className="cursor-pointer text-sm text-red-200">全部删除</summary>
    <p className="my-4 text-sm leading-6 text-neutral-300">将永久删除全部 {count} {unit}，包括不在当前页的项目。它们没有关联任何作品，删除不影响影视与观看记录。此操作无法撤销。</p>
    <form action={action} className="space-y-4">
      <input type="hidden" name="report" value={report} />
      <label>输入数量 {count} 以确认删除<input name="confirm_count" required inputMode="numeric" disabled={pending} autoComplete="off" /></label>
      <p role="alert" className="text-sm text-red-300">{state.error}</p>
      <button disabled={pending} className="admin-danger">{pending ? "正在删除…" : "永久删除"}</button>
    </form>
  </details>;
}
