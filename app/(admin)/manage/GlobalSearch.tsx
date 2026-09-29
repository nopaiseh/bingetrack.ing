"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { mediaTypes, type ManagedMediaType } from "@/lib/admin/media-form";
import { searchMedia, type MediaHit } from "./search-actions";

const badges: Record<ManagedMediaType, string> = {
  movie: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  tv_show: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  tv_season: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  tv_episode: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};
const filters: (ManagedMediaType | "all")[] = ["all", "movie", "tv_show", "tv_season", "tv_episode"];

/** 概览页的全局搜索：同时搜电影、电视节目、季与单集，可按类型缩小；方向键选择，回车打开。 */
export default function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<MediaHit[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState<ManagedMediaType | "all">("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const request = useRef(0);

  // 停止输入 250 毫秒后再搜索；只采用最后一次请求的结果，避免慢响应覆盖新结果。
  useEffect(() => {
    const search = term.trim();
    const id = ++request.current;
    if (!search) return;
    const timer = setTimeout(async () => {
      setPending(true);
      const result = await searchMedia(search).catch(() => ({ hits: [], error: "搜索失败，请重试。" }));
      if (id !== request.current) return;
      setHits(result.hits);
      setError(result.error ?? "");
      setActiveIndex(0);
      setPending(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  const searching = term.trim().length > 0;
  const visible = searching ? hits.filter(hit => filter === "all" || hit.type === filter) : [];
  const href = (hit: MediaHit) => `/manage/media/${hit.id}?type=${hit.type}`;
  const optionId = (index: number) => `${listId}-${index}`;

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!visible.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(index => (index + (event.key === "ArrowDown" ? 1 : visible.length - 1)) % visible.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      router.push(href(visible[Math.min(activeIndex, visible.length - 1)]));
    }
  }

  return <section aria-labelledby={`${listId}-title`} className="surface-panel space-y-3.5 rounded-2xl p-5 sm:p-6">
    <h2 id={`${listId}-title`} className="admin-section-title text-base font-medium text-white">全局搜索</h2>
    <label className="relative"><span className="sr-only">搜索全部影视</span>
      <span className={`${pending ? "i-material-symbols-sync-rounded animate-spin" : "i-material-symbols-search-rounded"} pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-subtle`} aria-hidden="true" />
      <input type="search" role="combobox" aria-expanded={visible.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={visible.length ? optionId(Math.min(activeIndex, visible.length - 1)) : undefined}
        value={term} maxLength={200} autoComplete="off" placeholder="搜索电影、电视节目、季和单集的标题或副标题"
        onChange={event => { setTerm(event.target.value); if (!event.target.value.trim()) { setHits([]); setError(""); setPending(false); } }}
        onKeyDown={onKeyDown} className="!min-h-12 !pl-12 !text-[15px]" />
    </label>
    {searching && hits.length > 0 && <div role="group" aria-label="限定类型" className="flex flex-wrap gap-2">
      {filters.map(value => {
        const count = value === "all" ? hits.length : hits.filter(hit => hit.type === value).length;
        const selected = filter === value;
        return <button key={value} type="button" aria-pressed={selected} onClick={() => { setFilter(value); setActiveIndex(0); }} disabled={!count && !selected}
          className={`!min-h-8 !rounded-full !px-3 !py-0 !text-[13px] ${selected ? "!border-[var(--accent-border)] !bg-[var(--accent-soft)] text-[var(--accent-light)]" : ""}`}>
          {value === "all" ? "全部" : mediaTypes[value]}<span className="font-mono text-xs opacity-80">{count}</span>
        </button>;
      })}
    </div>}
    {searching && <ul id={listId} role="listbox" aria-label="搜索结果" className="space-y-0.5 border-t border-white/10 pt-2">
      {visible.map((hit, index) => {
        const active = index === Math.min(activeIndex, visible.length - 1);
        return <li key={hit.id} id={optionId(index)} role="option" aria-selected={active}>
          <Link href={href(hit)} onMouseEnter={() => setActiveIndex(index)} className={`flex items-center gap-3.5 rounded-xl px-3 py-2.5 transition-colors ${active ? "bg-white/[0.06] outline outline-1 outline-white/12" : "hover:bg-white/5"}`}>
            {hit.coverUrl ? <Image src={hit.coverUrl} alt="" width={30} height={45} className="h-[45px] w-[30px] shrink-0 rounded object-cover" /> : <span className="surface-muted h-[45px] w-[30px] shrink-0 rounded border border-white/10" aria-hidden="true" />}
            <span className="min-w-0 flex-1"><span className="block truncate font-medium text-white">{hit.title}</span><span className="block truncate text-[13px] text-neutral-400">{hit.context}</span></span>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badges[hit.type]}`}>{mediaTypes[hit.type]}</span>
          </Link>
        </li>;
      })}
      {!pending && !visible.length && <li className="px-3 py-4 text-sm text-neutral-400">{error || "没有匹配的条目，试试其他标题或副标题。"}</li>}
    </ul>}
    <p className="text-xs text-neutral-400">{searching ? "↑↓ 选择 · 回车打开 · 单集与季直接进入所属节目的工作台" : "输入标题或副标题即可搜索，最多显示 40 条。"}</p>
  </section>;
}
