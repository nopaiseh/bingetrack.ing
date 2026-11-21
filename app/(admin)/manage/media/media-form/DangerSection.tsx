"use client";

import type { RefObject } from "react";
import { ActionNotice } from "../../StatusModal";
import type { ActionResult } from "@/app/(admin)/manage/actions";
import { deleteHints, deleteLabels } from "./constants";
import type { MediaInput, ManagedMediaType } from "@/lib/admin/media-form";

/** 已有条目的危险删除入口。 */
export function DangerSection({
  type,
  isTvChild,
  isAlbum,
  impact,
  onConfirm,
}: {
  type: ManagedMediaType;
  isTvChild: boolean;
  isAlbum: boolean;
  impact?: { seasons: number; episodes: number; tracks?: number };
  onConfirm: () => void;
}) {
  return (
    <section className="edit-card edit-danger" aria-labelledby="edit-danger-heading">
      <header className="edit-card-head">
        <h2 id="edit-danger-heading">危险操作</h2>
      </header>
      <p className="edit-hint">{deleteHints[type]}</p>
      {impact && (isTvChild || type === "tv_show") ? (
        <p className="edit-hint">
          本次还会删除 {impact.seasons} 季、{impact.episodes} 集及其观看记录。
        </p>
      ) : null}
      {impact && isAlbum && (impact.tracks ?? 0) > 0 ? (
        <p className="edit-hint">本次还会删除 {impact.tracks} 首曲目及其收听记录。</p>
      ) : null}
      <button type="button" className="admin-danger" onClick={onConfirm}>
        {deleteLabels[type]}
      </button>
    </section>
  );
}

/** 删除确认弹窗；仅在编辑已有条目时渲染。 */
export function DeleteDialog({
  item,
  type,
  isTvChild,
  isAlbum,
  impact,
  pending,
  deleting,
  deleteAction,
  deleteState,
  confirmDialog,
  confirmHeading,
  confirmInput,
}: {
  item: MediaInput;
  type: ManagedMediaType;
  isTvChild: boolean;
  isAlbum: boolean;
  impact?: { seasons: number; episodes: number; tracks?: number };
  pending: boolean;
  deleting: boolean;
  deleteAction: (payload: FormData) => void;
  deleteState: ActionResult;
  confirmDialog: RefObject<HTMLDialogElement | null>;
  confirmHeading: string;
  confirmInput: RefObject<HTMLInputElement | null>;
}) {
  return (
    <dialog
      ref={confirmDialog}
      aria-labelledby={confirmHeading}
      className="admin-quick-dialog"
      onCancel={(event) => {
        if (deleting) event.preventDefault();
      }}
    >
      <h2 id={confirmHeading} className="break-words text-xl font-semibold text-white">
        永久删除「{item.title}」？
      </h2>
      <p className="my-4 text-sm leading-relaxed text-fg-secondary">
        将删除这个条目及其
        {type === "book" ? "阅读" : type === "album" || type === "music" ? "收听" : "观看"}
        记录、评分和关联。
        {type === "tv_show"
          ? "所有下属季和集的资料、观看记录及评分也会一起删除。"
          : type === "tv_season"
            ? "此季的所有集及其观看记录和评分也会一起删除。"
            : type === "album"
              ? "所有下属曲目、收听记录及艺人关联也会一起删除。"
              : type === "book"
                ? "作者关联也会一起删除。"
                : ""}
        此操作无法撤销。
      </p>
      {impact && (isTvChild || type === "tv_show") && (
        <p className="mb-4 text-sm text-red-200">
          本次还会删除 {impact.seasons} 季、{impact.episodes} 集及其观看记录。
        </p>
      )}
      {impact && isAlbum && (impact.tracks ?? 0) > 0 && (
        <p className="mb-4 text-sm text-red-200">本次还会删除 {impact.tracks} 首曲目及其收听记录。</p>
      )}
      <form action={deleteAction} className="space-y-4">
        <input type="hidden" name="id" value={item.id ?? ""} />
        <label>
          输入完整标题以确认删除
          <input ref={confirmInput} name="confirm_title" required autoComplete="off" disabled={pending || deleting} />
        </label>
        <ActionNotice state={deleteState} />
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" disabled={deleting} onClick={() => confirmDialog.current?.close()}>
            取消
          </button>
          <button className="admin-danger" type="submit" disabled={pending || deleting}>
            {deleting ? "正在删除…" : "永久删除"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
