"use client";
import { useActionState, useState } from "react";
import { saveCollectionMember } from "../reference-actions";
import { useDraftFields } from "../useDraftFields";
import ChoicePicker from "../ChoicePicker";
import type { ActionResult } from "../actions";
/** 系列成员可独立添加、改序或移除，移除不会删除作品。 */
export default function CollectionMember({ series, item }: { series: string; item?: { id: string; title: string; position: number | null } }) {
  const [pickerKey, setPickerKey] = useState(0);
  const field = useDraftFields();
  const [state, action, pending] = useActionState(async (previous: ActionResult, form: FormData) => {
    const result = await saveCollectionMember(previous, form);
    if (result.saved && !item) {
      field.reset();
      setPickerKey(k => k + 1);
    }
    return result;
  }, {});
  return <form action={action} className="rounded-xl border border-white/10 p-4"><fieldset disabled={pending} className="space-y-3"><legend className="sr-only">{item ? `调整${item.title}` : "添加系列作品"}</legend><input type="hidden" name="series_id" value={series} />{item ? <input type="hidden" name="media_item_id" value={item.id} /> : <ChoicePicker key={pickerKey} kind="media" name="media_item_id" label="作品" multiple={false} />}
    <div className="flex flex-wrap items-end gap-3"><label className="max-w-36">顺序<input type="number" name="position" {...field("position", item?.position ?? 0)} min={0} max={100000} required /></label><button name="intent" value="save">{pending ? "正在保存…" : item ? "保存顺序" : "添加作品"}</button>{item && <button name="intent" value="remove">移除关联</button>}</div><p role="alert" className="text-sm text-red-300">{state.error}</p>{state.saved && <p role="status" className="text-sm text-green-300">关联已更新。</p>}
  </fieldset></form>;
}
