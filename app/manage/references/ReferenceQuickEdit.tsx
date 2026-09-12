"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { mayLeaveEditor } from "@/lib/admin/navigation";
import { referenceTypes } from "@/lib/admin/catalog";
import ReferenceForm from "./ReferenceForm";
/** 类型、地区与语言用原生弹窗快速维护，完整详情仍有独立可访问地址。 */
export default function ReferenceQuickEdit({ kind, item, count }: { kind: "genres" | "regions" | "languages"; item?: { id: string; name: string }; count?: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  const heading = useId();
  return <><button className={item ? "!min-h-9 !px-3 !py-1" : "admin-primary"} onClick={() => setOpen(true)}>{item ? "编辑" : `新增${referenceTypes[kind].label}`}</button>
    <dialog ref={dialog} onClose={() => setOpen(false)} aria-labelledby={heading} className="admin-quick-dialog" onCancel={event => { if (!mayLeaveEditor()) event.preventDefault(); }}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id={heading} className="text-xl font-semibold text-white">{item ? "编辑" : "新增"}{referenceTypes[kind].label}</h2><button aria-label="关闭编辑" onClick={() => { if (mayLeaveEditor()) dialog.current?.close(); }}>×</button></div>
      {open && <ReferenceForm kind={kind} item={item} count={count} onSaved={() => setOpen(false)} />}
      {item && <Link href={`/manage/references/${kind}/${item.id}`} className="mt-5 inline-block text-sm text-neutral-300">查看关联作品 →</Link>}
    </dialog>
  </>;
}
