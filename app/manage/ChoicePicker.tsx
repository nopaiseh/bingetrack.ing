"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { searchChoices } from "./reference-actions";
import type { Choice } from "@/lib/admin/catalog";

/** 搜索已有资料并显式选择；名称标签可新增，父条目只能选已有内容。 */
export default function ChoicePicker({ kind, name, label, initial = [], multiple = true, allowCreate = false, required = false, sortable = name === "actors", onSelect }: {
  kind: string; name: string; label: string; initial?: Choice[]; multiple?: boolean; allowCreate?: boolean; required?: boolean; sortable?: boolean; onSelect?: (value: Choice[]) => void;
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
  /** 关联名称去重，单选父级保存真实 ID。选择后清理检索词并关闭下拉。 */
  function choose(choice: Choice) {
    change(multiple ? [...selected.filter(item => item.name !== choice.name), choice] : [choice]);
    setOpen(false);
    setTerm("");
  }
  return <div ref={root} className="relative min-w-0" onBlur={/* 焦点离开整个选择器后关闭结果。 */ event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <input type="hidden" name={name} value={multiple ? selected.map(item => item.name).join("\n") : selected[0]?.id ?? ""} />
    <div className="mb-1.5 flex items-center justify-between">
      <label htmlFor={!multiple && selected.length > 0 ? undefined : listId}>{label}</label>
      {required && <span className="text-[11px] font-normal text-rose-400/80">必填</span>}
    </div>
    {multiple && selected.length > 0 && <ul className="my-2.5 flex flex-wrap gap-2">{selected.map(/* 已选名称可独立移除，可排序字段支持微调顺序。 */ (item, index) => <li key={item.id} className="admin-tag-chip group/chip max-w-full">{sortable && <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-[10px] font-medium leading-none text-neutral-300">#{index + 1}</span>}<span className="break-words font-medium">{item.name}</span>{sortable ? <div className="ml-1 flex items-center gap-0.5 border-l border-white/10 pl-1">{index > 0 && <button type="button" title={`前移${item.name}`} aria-label={`上移${item.name}`} className="inline-flex size-4.5 items-center justify-center rounded text-neutral-400 hover:bg-white/10 hover:text-white transition-colors" onClick={() => { const next = [...selected]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; change(next); }}><span className="i-material-symbols-chevron-left-rounded size-3.5" aria-hidden="true" /></button>}{index < selected.length - 1 && <button type="button" title={`后移${item.name}`} aria-label={`下移${item.name}`} className="inline-flex size-4.5 items-center justify-center rounded text-neutral-400 hover:bg-white/10 hover:text-white transition-colors" onClick={() => { const next = [...selected]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; change(next); }}><span className="i-material-symbols-chevron-right-rounded size-3.5" aria-hidden="true" /></button>}<button type="button" title={`移除关联：${item.name}`} aria-label={`移除关联：${item.name}`} className="inline-flex size-4.5 items-center justify-center rounded text-neutral-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors" onClick={() => change(selected.filter(value => value.id !== item.id))}><span className="i-material-symbols-close-rounded size-3.5" aria-hidden="true" /></button></div> : <button type="button" title={`移除关联：${item.name}`} aria-label={`移除关联：${item.name}`} className="inline-flex size-4.5 items-center justify-center rounded text-neutral-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors" onClick={() => change(selected.filter(value => value.id !== item.id))}><span className="i-material-symbols-close-rounded size-3.5" aria-hidden="true" /></button>}</li>)}</ul>}
    {!multiple && selected.length > 0 ? (
      <div className="flex h-[42px] items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="i-material-symbols-folder-rounded size-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <span className="truncate font-medium text-white">{selected[0].name}</span>
          {selected[0].detail && <span className="truncate text-xs text-neutral-400">({selected[0].detail})</span>}
        </div>
        <button
          type="button"
          aria-label={`更换${label}：当前为${selected[0].name}`}
          className="!min-h-0 !border-0 !bg-transparent !p-1 text-xs text-neutral-400 transition-colors hover:text-white shrink-0"
          onClick={() => {
            change([]);
            setTerm("");
            setOpen(true);
            setTimeout(() => input.current?.focus(), 50);
          }}
        >
          更换
        </button>
      </div>
    ) : (
      <input ref={input} id={listId} value={term} autoComplete="off" placeholder={`搜索${label}`} role="combobox" aria-autocomplete="list" aria-haspopup="dialog" aria-expanded={open} aria-controls={`${listId}-results`} onFocus={() => setOpen(true)} onChange={event => { setTerm(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter") { event.preventDefault(); setOpen(true); } }} />
    )}
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
