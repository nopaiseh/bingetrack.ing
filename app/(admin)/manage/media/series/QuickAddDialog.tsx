"use client";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { saveMedia, type ActionResult } from "../../actions";
import { mayLeaveEditor } from "@/lib/admin/navigation";
import type { SeriesStructure } from "@/lib/admin/series-structure";
import { formatCount, type QuickAddKind } from "./shared";
import { ActionNotice } from "../../StatusModal";

/** 预填日期的来源说明，推算不出时说明原因。 */
const dateHints = {
  interval: "日期按最近的播出间隔推算，可直接修改。",
  single: "只有一集有播出日期，按每周推算，可直接修改。",
  same_day: "最近几集同一天上线，没有间隔可推算，请手动填写日期。",
  missing: "最近几集没有播出日期，请手动填写。",
  irregular: "播出日期倒序或间隔超过一年，未预填日期。",
} as const;

/** 就地新增单集或季：编号、日期与时长按已有资料预填；连续录入时保存后留在弹窗，侧栏随即刷新。 */
export default function QuickAddDialog({ kind, structure, onClose }: { kind: QuickAddKind; structure: SeriesStructure; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const numberId = useId();
  const [keepGoing, setKeepGoing] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [state, action, pending] = useActionState(async (previous: ActionResult, form: FormData) => {
    const result = await saveMedia(previous, form);
    if (result.saved) setLastSaved(String(form.get("title") ?? ""));
    return result;
  }, {});
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);

  const episode = kind === "episode";
  const season = structure.seasons.find(item => item.id === structure.expandedSeasonId);
  const next = episode ? structure.nextEpisode : null;
  const number = episode ? next?.number ?? 1 : structure.nextSeasonNumber;
  const unit = episode ? "集" : "季";
  const parentId = episode ? structure.expandedSeasonId : structure.show.id;
  if (!parentId) return null;

  return <dialog ref={dialog} aria-labelledby={heading} className="admin-quick-dialog" onClose={onClose} onCancel={event => { if (pending) event.preventDefault(); }}>
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-2.5">
        <h2 id={heading} className="text-xl font-semibold text-white">新增{episode ? "单集" : "季"}</h2>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-400">
          <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-300">{structure.show.title}</span>
          {episode && season && <><span className="i-material-symbols-chevron-right-rounded size-4" aria-hidden="true" /><span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">第 {season.number} 季</span></>}
          {episode && next?.afterTitle && <span className="ml-1 break-words">接在「{next.afterTitle}」之后</span>}
        </p>
      </div>
      <button type="button" aria-label="关闭" disabled={pending} className="!min-h-9 !px-2.5" onClick={() => dialog.current?.close()}><span className="i-material-symbols-close-rounded size-5" aria-hidden="true" /></button>
    </div>
    {lastSaved !== null && state.saved && <ActionNotice state={state} saved={`已新增「${lastSaved}」，继续填写第 ${formatCount(number)} ${unit}。`} />}
    {/* 保存后侧栏刷新，编号随之变化；以编号为 key 重建表单，清空上一条的输入。 */}
    <form key={`${kind}:${number}`} action={action} onSubmit={event => { if (!keepGoing && !mayLeaveEditor()) event.preventDefault(); }}>
      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">新增{episode ? "单集" : "季"}资料</legend>
        <input type="hidden" name="id" value="" />
        <input type="hidden" name="type" value={episode ? "tv_episode" : "tv_season"} />
        <input type="hidden" name="parent_id" value={parentId} />
        <input type="hidden" name="after" value={keepGoing ? "continue" : "open"} />
        <div className="grid gap-4 sm:grid-cols-2">
          {/* 「第」「集」只作视觉提示，放在 label 之外，字段名称只含标签文字。 */}
          <div className="grid min-w-0 gap-[.45rem]">
            <label htmlFor={numberId}>{episode ? "集编号" : "季编号（特别篇可填 0）"}</label>
            <span className="relative flex items-center">
              <span aria-hidden="true" className="pointer-events-none absolute left-3.5 select-none text-sm text-neutral-400">第</span>
              <input id={numberId} name="number" type="number" min="0" max="100000" step="1" required defaultValue={number} className="!pl-9 !pr-10 font-mono font-semibold" />
              <span aria-hidden="true" className="pointer-events-none absolute right-3.5 select-none text-sm text-neutral-400">{unit}</span>
            </span>
          </div>
          {episode && <label>发行日期<input name="release_date" type="date" defaultValue={next?.releaseDate ?? ""} className="font-mono" /></label>}
        </div>
        {episode && next && <p className="-mt-2 text-xs text-neutral-400">{dateHints[next.dateBasis]}</p>}
        <label>标题<input name="title" required maxLength={300} autoFocus placeholder={episode ? "单集标题" : `第 ${number} 季`} defaultValue={episode ? "" : `第 ${number} 季`} /></label>
        <label>其他标题<input name="alternate_title" maxLength={300} placeholder="外文原名或别名（可选）" /></label>
        {episode && <div className="grid gap-4 sm:grid-cols-2">
          <label>时长（分钟）<input name="runtime" type="number" min="0" max="100000" step="any" defaultValue={next?.runtime ?? ""} className="font-mono" /></label>
          <label>评分（可留空）<input name="rating" type="number" min="0" max="10" step="0.1" placeholder="填写即标为看过" className="font-mono" /></label>
        </div>}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm text-neutral-300 hover:text-white">
            <span className="i-material-symbols-chevron-right-rounded size-4.5 transition-transform group-open:rotate-90" aria-hidden="true" />更多字段：封面、简介
          </summary>
          <div className="mt-3 space-y-4">
            <label>封面地址（TMDB）<input name="cover_url" type="url" maxLength={2000} placeholder="https://image.tmdb.org/t/p/original/…" /></label>
            <label>简介<textarea name="summary" rows={3} maxLength={20000} placeholder="输入剧情梗概…" /></label>
          </div>
        </details>
        <ActionNotice state={state} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <label className="!flex !items-center !gap-2.5 text-sm !font-normal text-neutral-200">
            <input type="checkbox" checked={keepGoing} onChange={event => setKeepGoing(event.target.checked)} className="!size-4.5 !min-w-0 !p-0 accent-[var(--accent)]" />
            保存后继续新增第 {formatCount(number + 1)} {unit}
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => dialog.current?.close()}>取消</button>
            <button type="submit" className="admin-primary">{pending ? "正在保存…" : `保存${episode ? "单集" : "季"}`}</button>
          </div>
        </div>
      </fieldset>
    </form>
    <p className="mt-4 text-xs text-neutral-400">需要填写完整资料？<Link href={`/manage/media/new?type=${episode ? "tv_episode" : "tv_season"}&parent=${parentId}`} className="text-neutral-200 underline hover:text-white">打开完整表单 →</Link></p>
  </dialog>;
}
