"use client";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { saveMedia, type ActionResult } from "../../actions";
import ChoicePicker from "../../ChoicePicker";
import type { AlbumStructure } from "@/lib/admin/album-structure";
import { ActionNotice } from "../../StatusModal";
import { formatCount } from "./shared";

/** 就地新增曲目：曲序预填下一号；歌手默认带上专辑艺人（人物 ID），可改可清。 */
export default function QuickAddTrackDialog({
  structure,
  onClose,
}: {
  structure: AlbumStructure;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const numberId = useId();
  const [keepGoing, setKeepGoing] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [artistKey, setArtistKey] = useState(0);
  const [state, action, pending] = useActionState(async (previous: ActionResult, form: FormData) => {
    form.set("after", keepGoing ? "continue" : "open");
    const result = await saveMedia(previous, form);
    if (result.saved) {
      setLastSaved(String(form.get("title") ?? ""));
      // 连续录入时重建艺人选择器，再次预填专辑歌手。
      setArtistKey((key) => key + 1);
    }
    if (result.saved && !keepGoing) onClose();
    return result;
  }, {});

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  const nextNumber = structure.nextTrackNumber;
  const defaultArtists = structure.album.artists.map((person) => ({
    id: person.id,
    name: person.name,
    detail: person.alternateName ?? undefined,
  }));

  return (
    <dialog
      ref={dialog}
      aria-labelledby={heading}
      className="admin-quick-dialog"
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <h2 id={heading} className="text-xl font-semibold text-white">
            新增曲目
          </h2>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-400">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              {structure.album.title}
            </span>
            <span>第 {formatCount(nextNumber)} 首</span>
          </p>
          {lastSaved ? <p className="text-sm text-[var(--accent-light)]">已保存「{lastSaved}」</p> : null}
        </div>
        <button type="button" aria-label="关闭" disabled={pending} onClick={onClose} className="!w-11 !px-0">
          <span className="i-material-symbols-close-rounded size-5" aria-hidden="true" />
        </button>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="type" value="music" />
        <input type="hidden" name="parent_id" value={structure.album.id} />
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor={numberId}>
            曲序
            <input
              id={numberId}
              name="number"
              type="number"
              min="0"
              max="100000"
              step="1"
              required
              defaultValue={nextNumber}
              className="font-mono"
            />
          </label>
          <label>
            时长（秒，可留空）
            <input name="runtime" type="number" min="0" max="100000" step="1" placeholder="秒" className="font-mono" />
          </label>
        </div>
        <label>
          曲名
          <input name="title" required maxLength={300} placeholder="曲目标题" autoFocus />
        </label>
        <ChoicePicker
          key={`artists-${artistKey}`}
          kind="people"
          name="artists"
          label="演唱艺人"
          allowCreate
          sortable
          rows
          initial={defaultArtists}
        />
        <p className="edit-hint">默认带上专辑艺人（人物 ID）；可增删或清空。作词、作曲请在保存后于曲目编辑页填写。</p>
        <ActionNotice state={state} />
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={keepGoing}
            onChange={(event) => setKeepGoing(event.target.checked)}
            className="!w-auto"
          />
          保存后继续新增下一首
        </label>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" disabled={pending} onClick={onClose}>
            取消
          </button>
          <button type="submit" className="admin-primary" disabled={pending}>
            {pending ? "正在保存…" : "保存曲目"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
