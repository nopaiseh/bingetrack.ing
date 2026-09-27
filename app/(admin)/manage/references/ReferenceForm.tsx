"use client";
import { useActionState, useId, useRef, useState } from "react";
import { deleteReference, saveReference } from "../reference-actions";
import { referenceTypes, type ReferenceType } from "@/lib/admin/catalog";
import { useDraftFields } from "../useDraftFields";
import UnsavedGuard from "../UnsavedGuard";

/** 资料字段与危险操作分开：删除入口只占保存按钮旁的位置，确认表单放在弹窗里；重命名不重建关联对象。 */
export default function ReferenceForm({ kind, item, count = 0, onSaved }: { onSaved?: () => void; kind: ReferenceType; item?: { id: string; name: string; alternate_name?: string | null }; count?: number }) {
  const field = useDraftFields();
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(async (previous: { error?: string; saved?: boolean }, form: FormData) => { setDirty(false); const result = await saveReference(previous, form); if (result.error) setDirty(true); if (result.saved) { setDirty(false); onSaved?.(); } return result; }, {});
  const [deletion, deleteAction, deleting] = useActionState(deleteReference, {});
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const confirmHeading = useId();
  const confirmInput = useRef<HTMLInputElement>(null);
  /** 打开确认弹窗后直接聚焦名称输入框，省去一次点击。 */
  function openConfirm() {
    confirmDialog.current?.showModal();
    confirmInput.current?.focus();
  }
  return <>
    <UnsavedGuard dirty={dirty && !pending && !deleting} />
    <form action={action} onInput={() => setDirty(true)} className="surface-panel space-y-5 rounded-2xl p-5 sm:p-7"><fieldset disabled={pending || deleting} className="space-y-5"><legend className="sr-only">{referenceTypes[kind].label}资料</legend>
      {onSaved && <input type="hidden" name="return_list" value="1" />}<input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={item?.id ?? ""} />
      <label>名称<input name="name" {...field("name", item?.name)} required maxLength={200} placeholder={`输入${referenceTypes[kind].label}名称`} /></label>
      {referenceTypes[kind].alternate && <label>别名<input name="alternate_name" {...field("alternate_name", item?.alternate_name)} maxLength={300} placeholder="外文名或别称（可选）" /></label>}
      {item && <p className="text-sm text-neutral-400">修改名称后，已有作品会继续关联这项资料。</p>}
      <p role="alert" className="text-sm text-red-300">{state.error}</p><div className="flex flex-wrap items-center justify-between gap-3"><button className="admin-primary">{pending ? "正在保存…" : "保存资料"}</button>{item && <button type="button" className="admin-danger" onClick={openConfirm}>删除{referenceTypes[kind].label}</button>}</div>
    </fieldset></form>
    {item && <dialog ref={confirmDialog} aria-labelledby={confirmHeading} className="admin-quick-dialog" onCancel={event => { if (deleting) event.preventDefault(); }}>
      <h2 id={confirmHeading} className="break-words text-xl font-semibold text-white">永久删除「{item.name}」？</h2>
      <p className="my-4 text-sm leading-6 text-neutral-300">将删除这项{referenceTypes[kind].label}资料及其 {count} 个关联，影视作品与观看记录会保留。此操作无法撤销。</p>
      <form action={deleteAction} className="space-y-4"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={item.id} /><label>输入完整名称以确认删除<input ref={confirmInput} name="confirm_name" required disabled={pending || deleting} autoComplete="off" /></label><p role="alert" className="text-sm text-red-300">{deletion.error}</p>
        <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={deleting} onClick={() => confirmDialog.current?.close()}>取消</button><button disabled={pending || deleting} className="admin-danger">{deleting ? "正在删除…" : "永久删除"}</button></div></form>
    </dialog>}
  </>;
}
