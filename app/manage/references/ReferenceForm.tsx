"use client";
import { useActionState, useState } from "react";
import { deleteReference, saveReference } from "../reference-actions";
import { referenceTypes, type ReferenceType } from "@/lib/admin/catalog";
import { useDraftFields } from "../useDraftFields";
import UnsavedGuard from "../UnsavedGuard";

/** 资料字段与危险操作分开；重命名不重建关联对象。 */
export default function ReferenceForm({ kind, item, count = 0, onSaved }: { onSaved?: () => void; kind: ReferenceType; item?: { id: string; name: string; alternate_name?: string | null }; count?: number }) {
  const field = useDraftFields();
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(async (previous: { error?: string; saved?: boolean }, form: FormData) => { setDirty(false); const result = await saveReference(previous, form); if (result.error) setDirty(true); if (result.saved) { setDirty(false); onSaved?.(); } return result; }, {});
  const [deletion, deleteAction, deleting] = useActionState(deleteReference, {});
  return <>
    <UnsavedGuard dirty={dirty && !pending && !deleting} />
    <form action={action} onInput={() => setDirty(true)} className="surface-panel space-y-5 rounded-2xl p-5 sm:p-7"><fieldset disabled={pending || deleting} className="space-y-5"><legend className="sr-only">{referenceTypes[kind].label}资料</legend>
      {onSaved && <input type="hidden" name="return_list" value="1" />}<input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={item?.id ?? ""} />
      <label>名称<input name="name" {...field("name", item?.name)} required maxLength={200} /></label>
      {referenceTypes[kind].alternate && <label>别名<input name="alternate_name" {...field("alternate_name", item?.alternate_name)} maxLength={300} /></label>}
      {item && <p className="text-sm text-neutral-400">修改名称后，已有作品会继续关联这项资料。</p>}
      <p role="alert" className="text-sm text-red-300">{state.error}</p><button className="admin-primary">{pending ? "正在保存…" : "保存资料"}</button>
    </fieldset></form>
    {item && <details className="mt-8 rounded-2xl border border-white/10 p-5"><summary className="cursor-pointer text-sm text-red-200">删除{referenceTypes[kind].label}</summary><p className="my-4 text-sm leading-6 text-neutral-300">将永久删除「{item.name}」及其 {count} 个关联，保留影视作品与观看记录。此操作无法撤销。</p><form action={deleteAction} className="space-y-4"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={item.id} /><label>输入完整名称以确认删除<input name="confirm_name" required disabled={pending || deleting} autoComplete="off" /></label><p role="alert" className="text-red-300">{deletion.error}</p><button disabled={pending || deleting} className="admin-danger">{deleting ? "正在删除…" : "永久删除"}</button></form></details>}
  </>;
}
