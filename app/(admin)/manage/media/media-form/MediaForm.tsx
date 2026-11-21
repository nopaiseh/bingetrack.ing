"use client";

import { useActionState, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useDraftFields } from "../../useDraftFields";
import UnsavedGuard from "../../UnsavedGuard";
import { saveMedia, deleteMedia, type ActionResult } from "@/app/(admin)/manage/actions";
import { mediaTypes, type ManagedMediaType } from "@/lib/admin/media-form";
import { ActionNotice } from "../../StatusModal";
import { formatRuntime } from "@/lib/format-runtime";
import { normalizeCover } from "./cover";
import { BasicInfoSection } from "./BasicInfoSection";
import { FilmCastSection } from "./FilmCastSection";
import { MusicPeopleSection } from "./MusicPeopleSection";
import { BookAuthorsSection } from "./BookAuthorsSection";
import { CoverSection } from "./CoverSection";
import { PublishSection } from "./PublishSection";
import { DangerSection, DeleteDialog } from "./DangerSection";
import type { MediaFormProps, TypeFlags } from "./types";

export { albumCoverPreviewSrc } from "./cover";

/** 用同一表单编辑电影、电视节目、季、单集、专辑与曲目。保存栏在文档流顶部，不盖住字段。 */
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
}: MediaFormProps) {
  const field = useDraftFields();
  const [type, setType] = useState<ManagedMediaType>(item?.type ?? initialType);
  const [coverUrl, setCoverUrl] = useState(item?.cover_url ?? "");
  const [dirty, setDirty] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [bookStatus, setBookStatus] = useState<"want_to_watch" | "in_progress" | "watched">(
    item?.type === "book" &&
      (item.status === "want_to_watch" || item.status === "in_progress" || item.status === "watched")
      ? item.status
      : "want_to_watch",
  );
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
  const isTvChild = type === "tv_season" || type === "tv_episode";
  const isMusicTrack = type === "music";
  const isAlbum = type === "album";
  const isBook = type === "book";
  const isChild = isTvChild || isMusicTrack;
  const showCover = type === "movie" || type === "tv_show" || isAlbum || isBook;
  const showFilmCast = type === "movie" || type === "tv_show";
  const showMusicPeople = isAlbum || isMusicTrack;
  /** 电影／单集／曲目／图书可填评分；专辑发行日可填但评分由曲目汇总。 */
  const hasReleaseDate = type === "movie" || type === "tv_episode" || isAlbum || isMusicTrack || isBook;
  const hasRuntime = type === "movie" || type === "tv_episode" || isMusicTrack;
  const hasRatingInput = type === "movie" || type === "tv_episode" || isMusicTrack || isBook;
  const showTypeSelect = !(locked && (type === "tv_episode" || isMusicTrack));
  const flags: TypeFlags = {
    type,
    isTvChild,
    isMusicTrack,
    isAlbum,
    isBook,
    isChild,
    showCover,
    showFilmCast,
    showMusicPeople,
    hasReleaseDate,
    hasRuntime,
    hasRatingInput,
    showTypeSelect,
  };
  const titleField = field("title", item?.title);
  const summaryField = field("summary", item?.summary);
  const runtimeField = field("runtime", item?.runtime);
  const ratingField = field("rating", item?.rating != null ? Number(item.rating).toFixed(1) : null);
  const rated = ratingField.value.trim() !== "";
  const runtimeHint =
    runtimeField.value.trim() !== "" && Number(runtimeField.value) > 0
      ? isMusicTrack
        ? `${Math.floor(Number(runtimeField.value) / 60)}:${String(Math.floor(Number(runtimeField.value) % 60)).padStart(2, "0")}`
        : formatRuntime(Number(runtimeField.value))
      : null;
  const heading = titleField.value.trim() || (item ? item.title : `新增${mediaTypes[type]}`);
  const dateLabel =
    type === "tv_episode" ? "播出日期" : isAlbum || isMusicTrack ? "发行日期" : isBook ? "出版日期" : "上映日期";
  const listBackHref =
    type === "movie"
      ? "/manage?type=movie"
      : isAlbum || isMusicTrack
        ? "/manage?type=album"
        : isBook
          ? "/manage?type=book"
          : "/manage?type=tv_show";
  const listBackLabel = type === "movie" ? "电影" : isAlbum || isMusicTrack ? "音乐" : isBook ? "图书" : "电视节目";

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
    setBookStatus(
      item?.type === "book" &&
        (item.status === "want_to_watch" || item.status === "in_progress" || item.status === "watched")
        ? item.status
        : "want_to_watch",
    );
    setDirty(false);
    setResetKey((value) => value + 1);
  }

  function setRating(value: string) {
    ratingField.onChange({ target: { value } } as ChangeEvent<HTMLInputElement>);
    setDirty(true);
  }

  const activeScore =
    rated &&
    Number.isInteger(Number(ratingField.value)) &&
    Number(ratingField.value) >= 0 &&
    Number(ratingField.value) <= 10
      ? Number(ratingField.value)
      : null;

  return (
    <div>
      <UnsavedGuard dirty={dirty && !pending && !deleting} />
      <form
        ref={formRef}
        action={action}
        onInput={() => setDirty(true)}
        onSubmit={() => {
          const cover = formRef.current?.elements.namedItem("cover_url");
          if (cover instanceof HTMLInputElement && cover.type !== "hidden") {
            const next = normalizeCover(cover.value, type);
            cover.value = next;
            setCoverUrl(next);
          }
        }}
      >
        {/* 失败提示放在 .edit-frame 外：该 fieldset 有 container-type，会变成 fixed 的包含块。 */}
        <ActionNotice state={state} />
        <fieldset disabled={pending || deleting} className="edit-frame">
          <legend className="sr-only">媒体资料</legend>
          <input type="hidden" name="id" value={item?.id ?? ""} />
          {/* 单集／曲目仍保存提交的封面。季的 cover_url 由服务端忽略，不再提交。 */}
          {type === "tv_episode" || type === "music" ? (
            <input type="hidden" name="cover_url" value={item?.type === type ? (item.cover_url ?? "") : ""} />
          ) : null}
          {locked ? <input type="hidden" name="type" value={type} /> : null}

          <div className="edit-toolbar">
            <div className="min-w-0">
              <div className="edit-back">
                {parent ? (
                  <Link href={`/manage/media/${parent.id}?type=${parent.type}`}>← {parent.name}</Link>
                ) : (
                  <Link href={listBackHref}>← {listBackLabel}</Link>
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
              {publicHref ? (
                <Link className="admin-button" href={publicHref}>
                  {publicLabel}
                </Link>
              ) : null}
              <button type="button" onClick={discard} disabled={!dirty}>
                放弃更改
              </button>
              <button type="submit" className="admin-primary">
                {pending ? "正在保存…" : "保存"}
                <kbd className="edit-kbd" aria-hidden="true">
                  ⌘S
                </kbd>
              </button>
            </div>
          </div>

          <div className="edit-grid">
            <div className="edit-main">
              <BasicInfoSection
                flags={flags}
                item={item}
                parent={parent}
                ancestorName={ancestorName}
                nextNumber={nextNumber}
                locked={locked}
                resetKey={resetKey}
                field={field}
                titleField={titleField}
                summaryField={summaryField}
                runtimeField={runtimeField}
                runtimeHint={runtimeHint}
                dateLabel={dateLabel}
                onTypeChange={(next) => {
                  setType(next);
                  setDirty(true);
                }}
              />

              {showFilmCast ? <FilmCastSection item={item} resetKey={resetKey} /> : null}

              {showMusicPeople ? (
                <MusicPeopleSection item={item} resetKey={resetKey} isAlbum={isAlbum} isMusicTrack={isMusicTrack} />
              ) : null}

              {isBook ? <BookAuthorsSection item={item} resetKey={resetKey} /> : null}

              {item ? (
                <DangerSection
                  type={type}
                  isTvChild={isTvChild}
                  isAlbum={isAlbum}
                  impact={impact}
                  onConfirm={openConfirm}
                />
              ) : null}
            </div>

            <aside className="edit-rail" aria-label={isAlbum || isBook ? "封面与发布" : "海报与发布"}>
              {showCover ? (
                <CoverSection
                  type={type}
                  item={item}
                  coverUrl={coverUrl}
                  titleValue={titleField.value}
                  isAlbum={isAlbum}
                  isBook={isBook}
                  onCoverChange={(value) => {
                    setCoverUrl(value);
                    setDirty(true);
                  }}
                  onCoverBlur={(value) => setCoverUrl(normalizeCover(value, type))}
                />
              ) : null}

              <PublishSection
                flags={flags}
                item={item}
                resetKey={resetKey}
                ratingField={ratingField}
                rated={rated}
                activeScore={activeScore}
                bookStatus={bookStatus}
                onBookStatus={(value) => {
                  setBookStatus(value);
                  setDirty(true);
                }}
                onSetRating={setRating}
              />

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
      {item && (
        <DeleteDialog
          item={item}
          type={type}
          isTvChild={isTvChild}
          isAlbum={isAlbum}
          impact={impact}
          pending={pending}
          deleting={deleting}
          deleteAction={deleteAction}
          deleteState={deleteState}
          confirmDialog={confirmDialog}
          confirmHeading={confirmHeading}
          confirmInput={confirmInput}
        />
      )}
    </div>
  );
}
