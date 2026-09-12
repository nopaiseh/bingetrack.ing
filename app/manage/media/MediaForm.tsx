"use client";

import { useActionState, useState } from "react";
import { useDraftFields } from "../useDraftFields";
import ChoicePicker from "../ChoicePicker";
import UnsavedGuard from "../UnsavedGuard";
import type { Choice } from "@/lib/admin/catalog";
import { saveMedia, deleteMedia, type ActionResult } from "@/app/manage/actions";
import { mediaTypes, type MediaInput, type ManagedMediaType } from "@/lib/admin/media-form";

/** 用同一表单编辑电影、剧集、季和集，保持各字段有明确标签。 */
export default function MediaForm({ item, initialType = "movie", parent, nextNumber, impact }: { item?: MediaInput; initialType?: ManagedMediaType; parent?: Choice; nextNumber?: number; impact?: { seasons: number; episodes: number } }) {
  const field = useDraftFields();
  const [type, setType] = useState<ManagedMediaType>(item?.type ?? initialType);
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(async (previous: ActionResult, form: FormData) => {
    setDirty(false);
    const result = await saveMedia(previous, form);
    if (result.error) setDirty(true);
    return result;
  }, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteMedia, {});
  const isChild = type === "tv_season" || type === "tv_episode";
  return <div className="space-y-10">
    <UnsavedGuard dirty={dirty && !pending && !deleting} />
    <form action={action} onInput={() => setDirty(true)} className="surface-panel rounded-2xl p-5 sm:p-8">
      <fieldset disabled={pending || deleting} className="space-y-7">
        <legend className="sr-only">媒体资料</legend>
        <input type="hidden" name="id" value={item?.id ?? ""} />
        <div className="grid gap-5 sm:grid-cols-2">
          {item ? <><input type="hidden" name="type" value={type} /><p className="text-sm text-neutral-400">类型：{mediaTypes[type]}</p></> : <label>类型<select name="type" value={type} onChange={/* 切换新建条目的类型，编辑时类型不可更改。 */ event => setType(event.target.value as ManagedMediaType)}>{Object.entries(mediaTypes).map(/* 渲染四种受支持类型。 */ ([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
          <label>标题<input name="title" {...field("title", item?.title)} maxLength={300} required /></label>
          <label>其他标题<input name="alternate_title" {...field("alternate_title", item?.alternate_title)} maxLength={300} /></label>
          <label>发行日期<input type="date" name="release_date" {...field("release_date", item?.release_date)} /></label>
          <label>时长（分钟）<input type="number" name="runtime" min="0" max="100000" step="any" {...field("runtime", item?.runtime)} /></label>
          <label>封面地址（TMDB）<input type="url" name="cover_url" {...field("cover_url", item?.cover_url)} maxLength={2000} placeholder="https://image.tmdb.org/t/p/…" /></label>
          {isChild && <>
            <ChoicePicker key={type} kind={type === "tv_season" ? "tv_series" : "tv_season"} name="parent_id" label={type === "tv_season" ? "所属电视剧" : "所属剧季"} multiple={false} initial={parent && parent.detail === (type === "tv_season" ? "tv_series" : "tv_season") ? [parent] : []} />
            <label>{type === "tv_season" ? "季编号（特别篇可填 0）" : "集编号"}<input type="number" name="number" min="0" max="100000" step="1" {...field("number", item?.number ?? nextNumber)} required /></label>
          </>}
        </div>
        <label>简介<textarea name="summary" rows={5} maxLength={20000} {...field("summary", item?.summary)} /></label>
        <section className="surface-muted rounded-2xl border border-white/10 p-5 sm:p-6">
          <h2 className="admin-section-title mb-4 text-lg font-medium text-white">观看记录</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <label>观看状态<select name="status" {...field("status", item?.status ?? "want_to_watch")}><option value="want_to_watch">没看过</option><option value="watched">看过</option></select></label>
            <label>评分（0–10，可留空）<input type="number" name="rating" min="0" max="10" step="0.1" {...field("rating", item?.rating)} /></label>
          </div>
        </section>
        <section>
          <h2 className="admin-section-title mb-2 text-lg font-medium text-white">关联资料</h2>
          <p className="mb-4 text-sm text-neutral-400">搜索已有资料，或新增并关联。移除标签只解除当前作品的关联；演员可用上移按钮调整顺序。</p>
          <div className="grid gap-5 sm:grid-cols-2">{([['genres','类型标签'],['languages','语言'],['regions','地区'],['directors','导演'],['actors','演员'],['collections','系列']] as const).map(/* 名称标签与现有事务字段对应。 */ ([name, label]) => <ChoicePicker key={name} kind={name === "actors" || name === "directors" ? "people" : name} name={name} label={label} allowCreate initial={(item?.[name] ?? []).map(value => ({ id: value, name: value }))} />)}</div>
        </section>
        <div className="surface-overlay sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"><div><p className="text-sm text-neutral-300">{dirty ? "有未保存的修改" : "资料已载入"}</p><p role="alert" className="text-sm text-red-300">{state.error}</p></div><button type="submit" className="admin-primary">{pending ? "正在保存…" : "保存资料"}</button></div>
      </fieldset>
    </form>
    {item && <details className="rounded-2xl border border-white/10 p-5 sm:p-8">
      <summary className="mb-3 cursor-pointer text-sm text-red-200">删除条目</summary>
      <p className="mb-4 text-sm leading-relaxed text-neutral-300">将永久删除「{item.title}」及其观看记录、评分和关联。{type === "tv_series" ? "所有下属季和集的资料、观看记录及评分也会一起删除。" : type === "tv_season" ? "此季的所有集及其观看记录和评分也会一起删除。" : ""}此操作无法撤销。</p>
      {impact && (isChild || type === "tv_series") && <p className="mb-4 text-sm text-red-200">本次还会删除 {impact.seasons} 季、{impact.episodes} 集及其观看记录。</p>}
      <form action={deleteAction} className="space-y-4">
        <input type="hidden" name="id" value={item.id ?? ""} />
        <label>输入完整标题以确认删除<input name="confirm_title" required autoComplete="off" disabled={pending || deleting} /></label>
        <p role="alert" className="text-red-300">{deleteState.error}</p>
        <button className="admin-danger" type="submit" disabled={pending || deleting}>{deleting ? "正在删除…" : "永久删除"}</button>
      </form>
    </details>}
  </div>;
}
