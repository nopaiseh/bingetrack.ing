"use client";

import { useActionState, useState } from "react";
import { useDraftFields } from "../useDraftFields";
import ChoicePicker from "../ChoicePicker";
import UnsavedGuard from "../UnsavedGuard";
import type { Choice } from "@/lib/admin/catalog";
import { saveMedia, deleteMedia, type ActionResult } from "@/app/manage/actions";
import { mediaTypes, type MediaInput, type ManagedMediaType } from "@/lib/admin/media-form";

const typeConfigs: Record<ManagedMediaType, { label: string; icon: string; badgeClass: string; textClass: string; borderClass: string; bgClass: string }> = {
  movie: {
    label: "电影",
    icon: "i-material-symbols-movie-rounded",
    badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    textClass: "text-rose-300",
    borderClass: "!border-rose-500/30",
    bgClass: "!bg-rose-500/15",
  },
  tv_series: {
    label: "电视剧",
    icon: "i-material-symbols-tv-rounded",
    badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/25",
    textClass: "text-sky-300",
    borderClass: "!border-sky-500/30",
    bgClass: "!bg-sky-500/15",
  },
  tv_season: {
    label: "剧季",
    icon: "i-material-symbols-layers-rounded",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    textClass: "text-amber-300",
    borderClass: "!border-amber-500/30",
    bgClass: "!bg-amber-500/15",
  },
  tv_episode: {
    label: "剧集",
    icon: "i-material-symbols-video-library-rounded",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    textClass: "text-emerald-300",
    borderClass: "!border-emerald-500/30",
    bgClass: "!bg-emerald-500/15",
  },
};

/** 用同一表单编辑电影、剧集、季和集，保持各字段有明确标签。 */
export default function MediaForm({ item, initialType = "movie", lockType = false, parent, nextNumber, impact }: { item?: MediaInput; initialType?: ManagedMediaType; lockType?: boolean; parent?: Choice; nextNumber?: number; impact?: { seasons: number; episodes: number } }) {
  const field = useDraftFields();
  const [type, setType] = useState<ManagedMediaType>(item?.type ?? initialType);
  const [coverPreview, setCoverPreview] = useState(item?.cover_url ?? "");
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

        {/* 顶部影视类型标识（编辑时或锁定模式下为只读发光胶囊，新建未锁定时为现代分段单选控件） */}
        {(item || lockType) ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold tracking-wider text-neutral-400">媒体类型</span>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md ${typeConfigs[type].badgeClass}`}>
                <span className={`${typeConfigs[type].icon} size-3.5 inline-block`} aria-hidden="true" />
                <span>{typeConfigs[type].label}</span>
              </div>
            </div>
            <input type="hidden" name="type" value={type} />
          </div>
        ) : (
          <div className="space-y-2 border-b border-white/10 pb-5">
            <div className="flex items-center justify-between">
              <label htmlFor="media-type-select" className="text-xs font-semibold tracking-wider text-neutral-300">
                类型
              </label>
              <span className="text-[11px] text-neutral-500">选择后将自动适配表单结构</span>
            </div>
            <div className="admin-segmented-group" role="tablist" aria-label="媒体类型快捷选择">
              {(Object.keys(typeConfigs) as ManagedMediaType[]).map(t => {
                const config = typeConfigs[t];
                const isSelected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-2 transition-all duration-200 ${
                      isSelected
                        ? `${config.bgClass} ${config.textClass} ${config.borderClass} font-semibold shadow-sm`
                        : "!border-transparent text-neutral-400 hover:text-white hover:!bg-white/5"
                    }`}
                  >
                    <span className={`${config.icon} size-4 inline-block`} aria-hidden="true" />
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
            <select
              id="media-type-select"
              name="type"
              value={type}
              onChange={event => setType(event.target.value as ManagedMediaType)}
              className="sr-only"
              tabIndex={-1}
            >
              {Object.entries(mediaTypes).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {/* 基础元数据双列严整网格 */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="field-title">标题</label>
              <span className="text-[11px] font-normal text-rose-400/80">必填</span>
            </div>
            <input id="field-title" name="title" {...field("title", item?.title)} maxLength={300} placeholder="作品名称" required />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="field-alt-title">其他标题</label>
              <span className="text-[11px] font-normal text-neutral-500">原名 / 译名（可选）</span>
            </div>
            <input id="field-alt-title" name="alternate_title" {...field("alternate_title", item?.alternate_title)} maxLength={300} placeholder="外文原名或别名" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="field-release-date">发行日期</label>
              <span className="text-[11px] font-normal text-neutral-500">公映或首播</span>
            </div>
            <input id="field-release-date" type="date" name="release_date" {...field("release_date", item?.release_date)} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="field-runtime">时长（分钟）</label>
              <span className="text-[11px] font-normal text-neutral-500">分钟</span>
            </div>
            <input id="field-runtime" type="number" name="runtime" min="0" max="100000" step="any" {...field("runtime", item?.runtime)} placeholder="例如：120" />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="field-cover-url">封面地址（TMDB）</label>
              <span className="text-[11px] font-normal text-neutral-500">支持 TMDB 或外部图床</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <input
                  id="field-cover-url"
                  type="url"
                  name="cover_url"
                  defaultValue={item?.cover_url ?? ""}
                  onChange={e => { setCoverPreview(e.target.value.trim()); setDirty(true); }}
                  maxLength={2000}
                  placeholder="https://image.tmdb.org/t/p/original/…"
                />
              </div>
              {coverPreview && (
                <div className="relative h-11 w-8 shrink-0 overflow-hidden rounded-md border border-white/15 bg-black/40 shadow-sm" title="海报预览">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreview}
                    alt="封面预览"
                    className="h-full w-full object-cover"
                    onError={e => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                    onLoad={e => { (e.currentTarget as HTMLElement).style.display = "block"; }}
                  />
                </div>
              )}
            </div>
          </div>
          {isChild && <>
            <ChoicePicker
              key={type}
              kind={type === "tv_season" ? "tv_series" : "tv_season"}
              name="parent_id"
              label={type === "tv_season" ? "所属电视剧" : "所属剧季"}
              multiple={false}
              required
              initial={parent && parent.detail === (type === "tv_season" ? "tv_series" : "tv_season") ? [parent] : []}
            />
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="field-number">{type === "tv_season" ? "季编号" : "集编号"}</label>
                <span className="text-[11px] font-normal text-rose-400/80">
                  {type === "tv_season" ? "特别篇填 0 · 必填" : "必填"}
                </span>
              </div>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3.5 select-none text-sm font-medium text-neutral-400">第</span>
                <input
                  id="field-number"
                  type="number"
                  name="number"
                  min="0"
                  max="100000"
                  step="1"
                  {...field("number", item?.number ?? nextNumber)}
                  required
                  placeholder="1"
                  className="!pl-9 !pr-10 font-semibold"
                />
                <span className="pointer-events-none absolute right-3.5 select-none text-sm font-medium text-neutral-400">
                  {type === "tv_season" ? "季" : "集"}
                </span>
              </div>
            </div>
          </>}
        </div>

        {/* 剧情简介 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="field-summary">简介</label>
            <span className="text-[11px] font-normal text-neutral-500">故事概要</span>
          </div>
          <textarea id="field-summary" name="summary" rows={5} maxLength={20000} {...field("summary", item?.summary)} placeholder="输入剧情梗概…" />
        </div>

        {/* 观看记录 */}
        {type === "movie" || type === "tv_episode" ? (
          <section className="surface-muted rounded-2xl border border-white/10 p-5 sm:p-6">
            <h2 className="admin-section-title mb-4 text-lg font-medium text-white">观看记录</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="field-status" className="mb-1.5 block">观看状态</label>
                <select id="field-status" name="status" {...field("status", item?.status ?? "want_to_watch")}>
                  <option value="want_to_watch">没看过</option>
                  <option value="watched">看过</option>
                </select>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="field-rating">评分（0–10，可留空）</label>
                  <span className="text-[11px] font-normal text-neutral-500">满分 10</span>
                </div>
                <input id="field-rating" type="number" name="rating" min="0" max="10" step="0.1" {...field("rating", item?.rating)} placeholder="例如：8.5" />
              </div>
            </div>
          </section>
        ) : (
          <section className="surface-muted rounded-2xl border border-white/10 p-5 sm:p-6">
            <h2 className="admin-section-title mb-4 text-lg font-medium text-white">观看记录</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-400">观看状态：</span>
                <span className="surface-muted rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-200">
                  {item?.status === "watched" ? "看过" : item?.status === "watching" ? "在看" : "没看过"}
                  {item?.rating != null ? ` · ${item.rating} 分` : ""}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                {type === "tv_series" ? "电视剧" : "剧季"}的观看状态由下属剧集自动汇总决定，不可在此直接删改。
              </p>
            </div>
          </section>
        )}

        {/* 关联资料：仅电影和电视剧展示，剧季与剧集继承所属主条目资料 */}
        {!isChild && (
          <section>
            <h2 className="admin-section-title mb-2 text-lg font-medium text-white">关联资料</h2>
            <p className="mb-4 text-sm text-neutral-400">搜索已有资料，或新增并关联。移除标签只解除当前作品的关联；演员可用上移按钮调整顺序。</p>
            <div className="grid gap-5 sm:grid-cols-2">{([['genres','类型标签'],['languages','语言'],['regions','地区'],['directors','导演'],['actors','演员'],['collections','系列']] as const).map(/* 名称标签与现有事务字段对应。 */ ([name, label]) => <ChoicePicker key={name} kind={name === "actors" || name === "directors" ? "people" : name} name={name} label={label} allowCreate initial={(item?.[name] ?? []).map(value => ({ id: value, name: value }))} />)}</div>
          </section>
        )}
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
