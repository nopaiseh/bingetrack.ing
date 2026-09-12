"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { searchChoices } from "./reference-actions";
import type { Choice } from "@/lib/admin/catalog";

/** 搜索已有资料并显式选择；名称标签可新增，父条目只能选已有内容。 */
export default function ChoicePicker({ kind, name, label, initial = [], multiple = true, allowCreate = false, onSelect }: {
  kind: string; name: string; label: string; initial?: Choice[]; multiple?: boolean; allowCreate?: boolean; onSelect?: (value: Choice[]) => void;
}) {
  const [selected, setSelected] = useState(initial);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchChoices(kind, term);
        if (active) { setChoices(result.choices); setError(result.error ?? ""); }
      } catch { if (active) setError("搜索失败，请重新输入后重试。"); }
      finally { setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, term, open]);
  /** 通过隐藏字段复用现有服务端验证，显式通知外层表单存在修改。 */
  function change(next: Choice[]) {
    setSelected(next); onSelect?.(next);
    root.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }
  /** 关联名称去重，单选父级保存真实 ID。 */
  function choose(choice: Choice) {
    change(multiple ? [...selected.filter(item => item.name !== choice.name), choice] : [choice]);
    setTerm(""); input.current?.focus(); setOpen(false);
  }
  return <div ref={root} className="relative min-w-0" onBlur={/* 焦点离开整个选择器后关闭结果。 */ event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <input type="hidden" name={name} value={multiple ? selected.map(item => item.name).join("\n") : selected[0]?.id ?? ""} />
    <label htmlFor={listId}>{label}</label>
    {selected.length > 0 && <ul className="my-2 flex flex-wrap gap-2">{selected.map(/* 已选名称可独立移除和调整演员顺序。 */ (item, index) => <li key={item.id} className="flex max-w-full items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-sm"><span className="break-words">{item.name}</span>{multiple && index > 0 && <button type="button" aria-label={`上移${item.name}`} className="!min-h-8 !p-1" onClick={() => { const next = [...selected]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; change(next); }}>↑</button>}<button type="button" aria-label={`移除关联：${item.name}`} className="!min-h-8 !px-2 !py-0" onClick={() => change(selected.filter(value => value.id !== item.id))}>×</button></li>)}</ul>}
    <input ref={input} className="mt-2" id={listId} value={term} autoComplete="off" placeholder={`搜索${label}`} role="combobox" aria-autocomplete="list" aria-haspopup="dialog" aria-expanded={open} aria-controls={`${listId}-results`} onFocus={() => setOpen(true)} onChange={event => { setTerm(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter") { event.preventDefault(); setOpen(true); } }} />
    {open && <div role="dialog" aria-label={`${label}搜索结果`} id={`${listId}-results`} onMouseDown={event => { event.preventDefault(); }} className="surface-panel absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl p-2">
      {loading && <p role="status" className="p-2 text-sm text-neutral-400">正在搜索…</p>}
      {error && <p role="alert" className="p-2 text-sm text-red-300">{error}</p>}
      {!loading && !error && choices.filter(item => !selected.some(value => value.name === item.name)).map(item => <button key={item.id} type="button" className="mb-1 !w-full !justify-start !border-transparent !bg-transparent text-left hover:!bg-white/5" onClick={() => choose(item)}>{item.cover_url && <Image src={item.cover_url} width={28} height={42} alt="" className="h-10 w-7 shrink-0 rounded object-cover" />}<span className="min-w-0 break-words">{item.name}{item.detail && <span className="block text-xs text-neutral-400">{item.detail}</span>}</span></button>)}
      {!loading && !error && choices.length === 0 && <p className="p-2 text-sm text-neutral-400">没有匹配资料</p>}
      {allowCreate && term.trim() && !selected.some(item => item.name === term.trim()) && !choices.some(item => item.name === term.trim()) && <button type="button" className="!w-full !justify-start" onClick={() => choose({ id: `new:${term.trim()}`, name: term.trim() })}>新增并关联「{term.trim()}」</button>}
      <p className="p-2 text-xs text-neutral-400">{allowCreate ? "新名称将在保存资料时创建。" : "最多显示 20 项，可输入完整标题缩小范围。"}</p>
    </div>}
  </div>;
}
