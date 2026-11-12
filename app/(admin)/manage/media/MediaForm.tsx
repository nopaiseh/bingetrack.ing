"use client";

import { useActionState, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useDraftFields } from "../useDraftFields";
import ChoicePicker from "../ChoicePicker";
import UnsavedGuard from "../UnsavedGuard";
import type { ParentChoice } from "@/lib/admin/media-context";
import { saveMedia, deleteMedia, type ActionResult } from "@/app/(admin)/manage/actions";
import { mediaTypes, type MediaInput, type ManagedMediaType } from "@/lib/admin/media-form";
import { ActionNotice } from "../StatusModal";
import { formatRuntime } from "@/lib/format-runtime";
import { listInitial, listTint } from "../list/model";

const deleteLabels: Record<ManagedMediaType, string> = {
  movie: "删除这部电影…",
  tv_show: "删除这部电视节目…",
  tv_season: "删除这一季…",
  tv_episode: "删除这一集…",
};

const deleteHints: Record<ManagedMediaType, string> = {
  movie: "删除后会同时移除观看记录和演员关联，且无法恢复。",
  tv_show: "删除后会同时移除下属季、集、观看记录和演员关联，且无法恢复。",
  tv_season: "删除后会同时移除这一季的单集和观看记录，且无法恢复。",
  tv_episode: "删除后会同时移除观看记录，且无法恢复。",
};

/** 路径补成 TMDB 原图地址；已经是完整地址时原样保留，避免一次保存改掉尺寸。 */
function normalizeCover(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://image.tmdb.org/t/p/original/${trimmed.replace(/^\/+/, "")}`;
}

/** 预览只请求 TMDB 上的文件名。其它网站的地址和 javascript: 不进图片元素。 */
function posterPreviewSrc(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !trimmed.startsWith("https://image.tmdb.org/t/p/")) return null;
  if (trimmed.startsWith("https://image.tmdb.org/t/p/")) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:" || url.hostname !== "image.tmdb.org" || url.username || url.password || url.port) return null;
      if (!url.pathname.startsWith("/t/p/")) return null;
    } catch {
      return null;
    }
  }
  const file = trimmed.split(/[?#]/)[0]?.split("/").pop() ?? "";
  if (!/^[A-Za-z0-9._~-]{1,200}$/.test(file)) return null;
  return `https://image.tmdb.org/t/p/w500/${encodeURIComponent(file)}`;
}

function PosterPreview({ title, src }: { title: string; src: string }) {
  const [failed, setFailed] = useState(false);
  const preview = posterPreviewSrc(src);
  const showImage = Boolean(preview) && !failed;
  return (
    <div className="edit-poster" style={showImage ? undefined : { backgroundColor: listTint(title || "片") }}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview ?? undefined} alt="封面预览" onError={() => setFailed(true)} />
      ) : (
        <>
          <span className="edit-poster-letter">{listInitial(title || "片")}</span>
          <span className="edit-poster-caption">无海报</span>
        </>
      )}
    </div>
  );
}

/** 用同一表单编辑电影、电视节目、季和单集。保存栏在文档流顶部，不盖住字段。 */
export default function MediaForm({
  item,
  initialType = "movie",
  lockType = false,
  parent,
  ancestorName,
  nextNumber,
  impact,
  publicHref,
  publicLabel = "公开页面",
  meta,
}: {
  item?: MediaInput;
  initialType?: ManagedMediaType;
  lockType?: boolean;
  parent?: ParentChoice;
  ancestorName?: string | null;
  nextNumber?: number;
  impact?: { seasons: number; episodes: number };
  publicHref?: string | null;
  publicLabel?: string;
  meta?: string | null;
}) {
  const field = useDraftFields();
  const [type, setType] = useState<ManagedMediaType>(item?.type ?? initialType);
  const [coverUrl, setCoverUrl] = useState(item?.cover_url ?? "");
  const [dirty, setDirty] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [state, action, pending] = useActionState(async (previous: ActionResult, form: FormData) => {
    setDirty(false);
    const result = await saveMedia(previous, form);
    if (result.error) setDirty(true);
    return result;
  }, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteMedia, {});
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const confirmHeading = useId();
  const confirmInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const locked = Boolean(item || lockType);
  const isChild = type === "tv_season" || type === "tv_episode";
  const showCover = type !== "tv_episode";
  const showCast = !isChild;
  const dated = type === "movie" || type === "tv_episode";
  const showTypeSelect = !(locked && type === "tv_episode");
  const titleField = field("title", item?.title);
  const summaryField = field("summary", item?.summary);
  const runtimeField = field("runtime", item?.runtime);
  const ratingField = field("rating", item?.rating != null ? Number(item.rating).toFixed(1) : null);
  const rated = ratingField.value.trim() !== "";
  const runtimeHint = runtimeField.value.trim() !== "" && Number(runtimeField.value) > 0 ? formatRuntime(Number(runtimeField.value)) : null;
  const heading = titleField.value.trim() || (item ? item.title : `新增${mediaTypes[type]}`);
  const dateLabel = type === "tv_episode" ? "播出日期" : "上映日期";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** 打开确认弹窗后直接聚焦名称输入框，省去一次点击。 */
  function openConfirm() {
    confirmDialog.current?.showModal();
    confirmInput.current?.focus();
  }

  function discard() {
    field.reset();
    setCoverUrl(item?.cover_url ?? "");
    setType(item?.type ?? initialType);
    setDirty(false);
    setResetKey((value) => value + 1);
  }

  function setRating(value: string) {
    ratingField.onChange({ target: { value } } as ChangeEvent<HTMLInputElement>);
    setDirty(true);
  }

  const activeScore = rated && Number.isInteger(Number(ratingField.value)) && Number(ratingField.value) >= 0 && Number(ratingField.value) <= 10
    ? Number(ratingField.value)
    : null;

  return <div>
    <UnsavedGuard dirty={dirty && !pending && !deleting} />
    <form
      ref={formRef}
      action={action}
      onInput={() => setDirty(true)}
      onSubmit={() => {
        const cover = formRef.current?.elements.namedItem("cover_url");
        if (cover instanceof HTMLInputElement && cover.type !== "hidden") {
          const next = normalizeCover(cover.value);
          cover.value = next;
          setCoverUrl(next);
        }
      }}
    >
      <fieldset disabled={pending || deleting} className="edit-frame">
        <legend className="sr-only">媒体资料</legend>
        <input type="hidden" name="id" value={item?.id ?? ""} />
        {type === "tv_episode" ? <input type="hidden" name="cover_url" value={item?.type === "tv_episode" ? (item.cover_url ?? "") : ""} /> : null}
        {locked ? <input type="hidden" name="type" value={type} /> : null}

        <div className="edit-toolbar">
          <div className="min-w-0">
            <div className="edit-back">
              {parent ? (
                <Link href={`/manage/media/${parent.id}?type=${parent.type}`}>← {parent.name}</Link>
              ) : (
                <Link href={type === "movie" ? "/manage?type=movie" : "/manage?type=tv_show"}>← {type === "movie" ? "电影" : "电视节目"}</Link>
              )}
            </div>
            <div className="edit-title-row">
              <h1 className="admin-heading break-words">{heading}</h1>
              <span className="edit-type-badge">{mediaTypes[type]}</span>
              {locked ? <span className="sr-only">媒体类型</span> : null}
              {dirty ? <span className="edit-dirty">有未保存的更改</span> : null}
            </div>
            {meta ? <p className="edit-hint mt-1">{meta}</p> : null}
          </div>
          <div className="edit-toolbar-actions">
            {publicHref ? <Link className="admin-button" href={publicHref}>{publicLabel}</Link> : null}
            <button type="button" onClick={discard} disabled={!dirty}>放弃更改</button>
            <button type="submit" className="admin-primary">
              {pending ? "正在保存…" : "保存"}
              <kbd className="edit-kbd" aria-hidden="true">⌘S</kbd>
            </button>
          </div>
        </div>
        <ActionNotice state={state} />

        <div className="edit-grid">
          <div className="edit-main">
            <section className="edit-card edit-basic" aria-labelledby="edit-basic-heading">
              <header className="edit-card-head">
                <h2 id="edit-basic-heading">基本信息</h2>
                <p className="edit-hint">{type === "tv_episode" ? "单集不设海报或剧照，公开页沿用节目海报" : "显示在公开页面顶部"}</p>
              </header>
              {type === "tv_episode" ? (
                <p className="edit-note">已去掉图片输入。电影和电视节目仍可上传海报与剧照；单集只填文字资料。</p>
              ) : null}
              <div className="edit-fields">
                {type === "tv_episode" && ancestorName ? (
                  <div className="span-3">
                    <span className="edit-field-label" id="ancestor-label">所属节目</span>
                    <div className="edit-locked-value" aria-labelledby="ancestor-label">
                      <span className="truncate">{ancestorName}</span>
                      <span className="edit-hint">锁定</span>
                    </div>
                  </div>
                ) : null}
                {isChild ? (
                  <div className={type === "tv_episode" && ancestorName ? "span-3" : "span-3"}>
                    <ChoicePicker
                      key={`${resetKey}-${type}`}
                      kind={type === "tv_season" ? "tv_show" : "tv_season"}
                      name="parent_id"
                      label={type === "tv_season" ? "所属节目" : "所属季"}
                      multiple={false}
                      required
                      initial={parent && parent.type === (type === "tv_season" ? "tv_show" : "tv_season") ? [parent] : []}
                    />
                  </div>
                ) : null}
                {isChild ? (
                  <div className={type === "tv_episode" ? "span-2" : "span-3"}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label htmlFor="field-number">{type === "tv_season" ? "季编号（特别篇可填 0）" : "集编号"}</label>
                      <span className="edit-required">必填</span>
                    </div>
                    <input id="field-number" type="number" name="number" min="0" max="100000" step="1" {...field("number", item?.number ?? nextNumber)} required placeholder="1" className="font-mono" />
                  </div>
                ) : null}
                <div className={type === "tv_episode" ? "span-2" : "span-3"}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="field-title">中文标题</label>
                    <span className="edit-required">必填</span>
                  </div>
                  <input id="field-title" name="title" {...titleField} maxLength={300} placeholder="作品名称" required />
                </div>
                <div className={type === "tv_episode" ? "span-2" : "span-3"}>
                  <label htmlFor="field-alt-title" className="mb-1.5">原名 / 外文名</label>
                  <input id="field-alt-title" name="alternate_title" {...field("alternate_title", item?.alternate_title)} maxLength={300} placeholder="可留空" />
                </div>
                {dated ? (
                  <div className={showTypeSelect ? "span-2" : "span-3"}>
                    <label htmlFor="field-release-date" className="mb-1.5">{dateLabel}</label>
                    <DateField id="field-release-date" label={dateLabel} value={field("release_date", item?.release_date).value} onChange={field("release_date", item?.release_date).onChange} />
                  </div>
                ) : null}
                {dated ? (
                  <div className={showTypeSelect ? "span-2" : "span-3"}>
                    <label htmlFor="field-runtime" className="mb-1.5">片长</label>
                    <div className="edit-runtime">
                      <input id="field-runtime" type="number" name="runtime" min="0" max="100000" step="any" {...runtimeField} placeholder="分钟" className="font-mono" />
                      <span className="edit-hint">{runtimeHint ?? "单位为分钟"}</span>
                    </div>
                  </div>
                ) : null}
                {showTypeSelect && locked ? (
                  <div className="span-2">
                    <label htmlFor="field-type-locked" className="mb-1.5">类型</label>
                    <select id="field-type-locked" value={type} disabled aria-disabled="true">
                      {Object.entries(mediaTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                ) : showTypeSelect ? (
                  <div className="span-2">
                    <label htmlFor="media-type-select" className="mb-1.5">类型</label>
                    <select id="media-type-select" name="type" value={type} onChange={(event) => { setType(event.target.value as ManagedMediaType); setDirty(true); }}>
                      {Object.entries(mediaTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                ) : null}
                <div className="span-6">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="field-summary">简介</label>
                    <span className="edit-hint">当前 {summaryField.value.length} 字</span>
                  </div>
                  <textarea id="field-summary" name="summary" rows={6} maxLength={20000} {...summaryField} placeholder="输入剧情梗概…" />
                </div>
              </div>
            </section>

            {showCast ? (
              <section className="edit-card edit-cast-card" aria-labelledby="edit-cast-heading">
                <header className="edit-card-head">
                  <div>
                    <h2 id="edit-cast-heading">演职员</h2>
                    <p className="edit-hint">拖动左侧手柄排序。键盘可用上移、下移按钮。</p>
                  </div>
                </header>
                <ChoicePicker
                  key={`${resetKey}-directors`}
                  kind="people"
                  name="directors"
                  label="导演"
                  inline
                  allowCreate
                  initial={(item?.directors ?? []).map((person) => ({ id: person.id ?? `new:${person.name}`, name: person.name, detail: person.alternate_name ?? undefined }))}
                />
                <ChoicePicker
                  key={`${resetKey}-actors`}
                  kind="people"
                  name="actors"
                  label="演员"
                  allowCreate
                  sortable
                  withCharacter
                  rows
                  initial={(item?.actors ?? []).map((person) => ({ id: person.id ?? `new:${person.name}`, name: person.name, detail: person.alternate_name ?? undefined, character: person.character }))}
                />
              </section>
            ) : null}

            {item ? (
              <section className="edit-card edit-danger" aria-labelledby="edit-danger-heading">
                <header className="edit-card-head">
                  <h2 id="edit-danger-heading">危险操作</h2>
                </header>
                <p className="edit-hint">{deleteHints[type]}</p>
                {impact && (isChild || type === "tv_show") ? <p className="edit-hint">本次还会删除 {impact.seasons} 季、{impact.episodes} 集及其观看记录。</p> : null}
                <button type="button" className="admin-danger" onClick={openConfirm}>{deleteLabels[type]}</button>
              </section>
            ) : null}
          </div>

          <aside className="edit-rail" aria-label="海报与发布">
            {showCover ? (
              <section className="edit-card edit-poster-card" aria-labelledby="edit-poster-heading">
                <header className="edit-card-head">
                  <div>
                    <h2 id="edit-poster-heading">海报与图片</h2>
                    <p className="edit-hint">电影和电视节目保留海报与剧照；单集不设图片</p>
                  </div>
                </header>
                <div className="edit-poster-row">
                  <PosterPreview key={coverUrl} title={titleField.value || item?.title || mediaTypes[type]} src={coverUrl} />
                  <div className="min-w-0">
                    {normalizeCover(coverUrl) ? <p className="edit-hint">已填写海报地址，预览使用这张图片。</p> : <p className="edit-hint">无海报时的预览用标题首字和列表同款色块，公开页同样使用。</p>}
                  </div>
                </div>
                <button type="button" onClick={() => document.getElementById("field-cover-url")?.focus()}>从 TMDB 加载海报</button>
                <label htmlFor="field-cover-url" className="mb-1.5 mt-4">TMDB 海报路径</label>
                <input
                  id="field-cover-url"
                  name="cover_url"
                  type="text"
                  inputMode="url"
                  value={coverUrl}
                  onChange={(event) => { setCoverUrl(event.target.value); setDirty(true); }}
                  onBlur={(event) => setCoverUrl(normalizeCover(event.target.value))}
                  maxLength={2000}
                  placeholder="https://image.tmdb.org/t/p/original/…"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
                <p className="edit-hint">粘贴完整网址或文件路径。路径会补成 TMDB 原图地址后再保存。</p>
              </section>
            ) : null}

            <section className="edit-card edit-publish" aria-labelledby="edit-publish-heading">
              <header className="edit-card-head">
                <div>
                  <h2 id="edit-publish-heading">发布</h2>
                  <p className="edit-hint">{dated ? (type === "tv_episode" ? "本集观看状态与评分" : "分类标签与观看状态。会显示在公开页") : "分类标签与由单集汇总的观看状态"}</p>
                </div>
              </header>
              {showCast ? (
                <div className="edit-taxonomies">
                  <ChoicePicker key={`${resetKey}-genres`} kind="genres" name="genres" label="类型标签" inline allowCreate initial={(item?.genres ?? []).map((value) => ({ id: value, name: value }))} />
                  <ChoicePicker key={`${resetKey}-collections`} kind="collections" name="collections" label="系列" inline allowCreate initial={(item?.collections ?? []).map((value) => ({ id: value, name: value }))} />
                  <ChoicePicker key={`${resetKey}-regions`} kind="regions" name="regions" label="地区" inline allowCreate initial={(item?.regions ?? []).map((value) => ({ id: value, name: value }))} />
                  <ChoicePicker key={`${resetKey}-languages`} kind="languages" name="languages" label="语言" inline allowCreate initial={(item?.languages ?? []).map((value) => ({ id: value, name: value }))} />
                </div>
              ) : null}
              {dated ? (
                <div className="edit-watch">
                  <div className="edit-segment" role="group" aria-label="观看状态">
                    <button type="button" className="edit-segment-btn" aria-pressed={rated} onClick={() => document.getElementById("field-rating")?.focus()}>已看</button>
                    <button type="button" className="edit-segment-btn" aria-pressed={!rated} onClick={() => setRating("")}>未看</button>
                  </div>
                  <div className="mb-1.5 mt-4 flex items-center justify-between gap-2">
                    <label htmlFor="field-rating">评分（0–10，可留空）</label>
                    <span className="edit-hint font-mono">{rated ? `当前 ${ratingField.value}` : "未评分"}</span>
                  </div>
                  <input id="field-rating" type="number" name="rating" min="0" max="10" step="0.1" aria-describedby="field-rating-status" {...ratingField} placeholder="例如 8.5" className="font-mono" />
                  <div className="edit-score-row">
                    {Array.from({ length: 11 }, (_, score) => (
                      <button key={score} type="button" className="edit-score" aria-pressed={activeScore === score} aria-label={`${score} 分`} onClick={() => setRating(String(score))}>{score}</button>
                    ))}
                  </div>
                  <p id="field-rating-status" className="edit-hint">
                    <span>{rated ? "看过" : "没看过"}</span>
                    {rated ? "已评分，保存为看过" : "填写评分即标为看过"}
                  </p>
                </div>
              ) : (
                <div className="edit-watch">
                  <div className="edit-segment" role="group" aria-label="观看状态">
                    {([["watched", "看过"], ["watching", "在看"], ["want_to_watch", "没看过"]] as const).map(([value, label]) => (
                      <button key={value} type="button" className="edit-segment-btn" aria-pressed={(item?.status ?? "want_to_watch") === value} disabled>{label}</button>
                    ))}
                  </div>
                  {item?.rating != null ? <p className="edit-hint font-mono">当前 {Number(item.rating).toFixed(1)}</p> : null}
                  <p className="edit-hint">{type === "tv_show" ? "电视节目" : "季"}的观看状态由下属单集自动汇总决定，不可在此直接删改。</p>
                </div>
              )}
            </section>

            {item?.id ? (
              <section className="edit-card edit-record" aria-labelledby="edit-record-heading">
                <header className="edit-card-head">
                  <h2 id="edit-record-heading">记录</h2>
                </header>
                <dl className="edit-record-list">
                  <div>
                    <dt>ID</dt>
                    <dd className="font-mono">{item.id}</dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </aside>
        </div>
      </fieldset>
    </form>
    {item && <dialog ref={confirmDialog} aria-labelledby={confirmHeading} className="admin-quick-dialog" onCancel={event => { if (deleting) event.preventDefault(); }}>
      <h2 id={confirmHeading} className="break-words text-xl font-semibold text-white">永久删除「{item.title}」？</h2>
      <p className="my-4 text-sm leading-relaxed text-neutral-300">将删除这个条目及其观看记录、评分和关联。{type === "tv_show" ? "所有下属季和集的资料、观看记录及评分也会一起删除。" : type === "tv_season" ? "此季的所有集及其观看记录和评分也会一起删除。" : ""}此操作无法撤销。</p>
      {impact && (isChild || type === "tv_show") && <p className="mb-4 text-sm text-red-200">本次还会删除 {impact.seasons} 季、{impact.episodes} 集及其观看记录。</p>}
      <form action={deleteAction} className="space-y-4">
        <input type="hidden" name="id" value={item.id ?? ""} />
        <label>输入完整标题以确认删除<input ref={confirmInput} name="confirm_title" required autoComplete="off" disabled={pending || deleting} /></label>
        <ActionNotice state={deleteState} />
        <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={deleting} onClick={() => confirmDialog.current?.close()}>取消</button><button className="admin-danger" type="submit" disabled={pending || deleting}>{deleting ? "正在删除…" : "永久删除"}</button></div>
      </form>
    </dialog>}
  </div>;
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className="edit-date">
      <input id={id} name="release_date" type="text" inputMode="numeric" autoComplete="off" placeholder="YYYY-MM-DD" maxLength={10} pattern="\d{4}-\d{2}-\d{2}" spellCheck={false} className="font-mono" value={value} onChange={onChange} aria-describedby={`${id}-format`} />
      <button type="button" className="edit-icon" aria-label={`选择${label}`} onClick={() => picker.current?.showPicker?.()}>
        <span className="i-material-symbols-calendar-today-rounded size-5" aria-hidden="true" />
      </button>
      <input ref={picker} tabIndex={-1} aria-hidden="true" type="date" className="edit-date-native" value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""} onChange={onChange} />
      <p id={`${id}-format`} className="edit-hint">格式 YYYY-MM-DD</p>
    </div>
  );
}
