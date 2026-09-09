"use client";

import { useActionState, useState } from "react";
import { saveMedia, deleteMedia } from "@/app/admin/actions";
import { mediaTypes, type MediaInput, type ManagedMediaType } from "@/lib/admin/media-form";

/** 用同一表单编辑电影、剧集、季和集，保持各字段有明确标签。 */
export default function MediaForm({ item, initialType = "movie", parent = "" }: { item?: MediaInput; initialType?: ManagedMediaType; parent?: string }) {
  const [type, setType] = useState<ManagedMediaType>(item?.type ?? initialType);
  const [state, action, pending] = useActionState(saveMedia, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteMedia, {});
  const isChild = type === "tv_season" || type === "tv_episode";
  return <div className="space-y-10">
    <form action={action} className="space-y-7">
      <fieldset disabled={pending || deleting} className="space-y-7">
        <legend className="sr-only">媒体资料</legend>
        <input type="hidden" name="id" value={item?.id ?? ""} />
        <div className="grid gap-5 sm:grid-cols-2">
          {item ? <><input type="hidden" name="type" value={type} /><p className="text-sm text-neutral-400">类型：{mediaTypes[type]}</p></> : <label>类型<select name="type" value={type} onChange={/* 切换新建条目的类型，编辑时类型不可更改。 */ event => setType(event.target.value as ManagedMediaType)}>{Object.entries(mediaTypes).map(/* 渲染四种受支持类型。 */ ([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
          <label>标题<input name="title" defaultValue={item?.title ?? ""} maxLength={300} required /></label>
          <label>其他标题<input name="alternate_title" defaultValue={item?.alternate_title ?? ""} maxLength={300} /></label>
          <label>发行日期<input type="date" name="release_date" defaultValue={item?.release_date ?? ""} /></label>
          <label>时长（分钟）<input type="number" name="runtime" min="0" max="100000" step="any" defaultValue={item?.runtime ?? ""} /></label>
          <label>封面地址（TMDB）<input type="url" name="cover_url" defaultValue={item?.cover_url ?? ""} maxLength={2000} placeholder="https://image.tmdb.org/t/p/…" /></label>
          {isChild && <>
            <label>{type === "tv_season" ? "所属剧集 ID" : "所属季 ID"}<input name="parent_id" defaultValue={item?.parent_id ?? parent} required /><span className="text-xs text-neutral-400">从上级条目的「新增季／集」进入时会自动填入。</span></label>
            <label>{type === "tv_season" ? "季编号（特别篇可填 0）" : "集编号"}<input type="number" name="number" min="0" max="100000" step="1" defaultValue={item?.number ?? ""} required /></label>
          </>}
        </div>
        <label>简介<textarea name="summary" rows={5} maxLength={20000} defaultValue={item?.summary ?? ""} /></label>
        <section className="surface-panel rounded-xl p-5">
          <h2 className="mb-4 text-lg font-medium text-white">观看记录</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <label>观看状态<select name="status" defaultValue={item?.status ?? "want_to_watch"}><option value="want_to_watch">没看过</option><option value="watched">看过</option></select></label>
            <label>评分（0–10，可留空）<input type="number" name="rating" min="0" max="10" step="0.1" defaultValue={item?.rating ?? ""} /></label>
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-medium text-white">关联资料</h2>
          <p className="mb-4 text-sm text-neutral-400">每行填写一个名称。保存时会关联已有名称或创建新名称；清空可移除当前条目的关联。</p>
          <div className="grid gap-5 sm:grid-cols-2">{([['genres','类型标签'],['languages','语言'],['regions','地区'],['directors','导演'],['actors','演员（按显示顺序）']] as const).map(/* 名称逐行编辑以保留真实名称中的逗号。 */ ([name, label]) => <label key={name}>{label}<textarea name={name} rows={3} maxLength={10000} defaultValue={item?.[name].join("\n") ?? ""} /></label>)}</div>
        </section>
        <p role="alert" className="text-red-300">{state.error}</p>
        <button type="submit" className="admin-primary">{pending ? "正在保存…" : "保存资料"}</button>
      </fieldset>
    </form>
    {item && <section className="rounded-xl border border-red-800 p-5">
      <h2 className="mb-3 text-lg font-medium text-red-200">删除条目</h2>
      <p className="mb-4 text-sm leading-relaxed text-neutral-300">将永久删除「{item.title}」及其观看记录、评分和关联。{type === "tv_series" ? "所有下属季和集的资料、观看记录及评分也会一起删除。" : type === "tv_season" ? "此季的所有集及其观看记录和评分也会一起删除。" : ""}此操作无法撤销。</p>
      <form action={deleteAction} className="space-y-4">
        <input type="hidden" name="id" value={item.id ?? ""} />
        <label>输入完整标题以确认删除<input name="confirm_title" required autoComplete="off" disabled={pending || deleting} /></label>
        <p role="alert" className="text-red-300">{deleteState.error}</p>
        <button type="submit" disabled={pending || deleting}>{deleting ? "正在删除…" : "永久删除"}</button>
      </form>
    </section>}
  </div>;
}
