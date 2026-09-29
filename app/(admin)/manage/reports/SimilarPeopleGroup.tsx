"use client";
import Link from "next/link";
import { useActionState, useId, useRef, useState } from "react";
import { dismissSimilarPeople, mergePeople } from "../report-actions";

export type SimilarPerson = { id: string; name: string; alias: string | null; works: number };

/** 默认保留有别名、作品较多的人物；都相同时保留第一位。 */
function suggestKeep(people: SimilarPerson[]) {
  return [...people].sort((a, b) => Number(Boolean(b.alias)) - Number(Boolean(a.alias)) || b.works - a.works)[0].id;
}

/** 一组疑似重复的人物：选择保留哪一位后合并其余人物，或标记为不是同一人，之后不再出现。 */
export default function SimilarPeopleGroup({ people }: { people: SimilarPerson[] }) {
  const [keep, setKeep] = useState(() => suggestKeep(people));
  const [mergeState, mergeAction, merging] = useActionState(mergePeople, {});
  const [dismissState, dismissAction, dismissing] = useActionState(dismissSimilarPeople, {});
  const confirm = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const confirmHeading = useId();
  const kept = people.find(person => person.id === keep)!;
  const removed = people.filter(person => person.id !== keep);
  const movedWorks = removed.reduce((sum, person) => sum + person.works, 0);
  const label = (person: SimilarPerson) => `${person.name}（${person.alias ?? "未填别名"}）`;
  const busy = merging || dismissing;

  return <article aria-labelledby={heading} className="surface-panel space-y-4 rounded-2xl p-5 sm:p-6">
    <h2 id={heading} className="text-base font-semibold text-white">{people[0].name} <span className="font-mono text-sm font-normal text-neutral-400">{people.length} 位</span></h2>
    <fieldset disabled={busy} className="space-y-2">
      <legend className="mb-2 text-sm text-neutral-400">选择要保留的人物，其余人物的演职关联会并入他，然后删除。</legend>
      {people.map(person => <div key={person.id} className={`flex items-center gap-3 rounded-xl border pr-3.5 transition-colors ${keep === person.id ? "border-[var(--accent-border)] bg-[var(--accent-soft)]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
        <label className="!flex min-w-0 flex-1 cursor-pointer !items-center !gap-3 py-3 pl-3.5 !font-normal">
          <input type="radio" name={`${heading}-keep`} checked={keep === person.id} onChange={() => setKeep(person.id)} className="!size-4.5 !min-w-0 shrink-0 !p-0 accent-[var(--accent)]" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-white">{person.name}</span>
            <span className="block text-sm text-neutral-400">{person.alias ?? "未填别名"}</span>
          </span>
          <span className="whitespace-nowrap font-mono text-sm text-neutral-300">{person.works} 部作品</span>
          {keep === person.id && <span className="rounded-full border border-[var(--accent-border)] px-2.5 py-0.5 text-xs text-[var(--accent-light)]">保留</span>}
        </label>
        <Link href={`/manage/references/people/${person.id}`} aria-label={`查看${label(person)}的资料`} className="text-sm text-neutral-300 hover:text-white">资料 →</Link>
      </div>)}
    </fieldset>
    <p role="alert" className="text-sm text-red-300">{mergeState.error ?? dismissState.error}</p>
    <div className="flex flex-wrap items-center justify-end gap-3">
      <form action={dismissAction}>
        {people.map(person => <input key={person.id} type="hidden" name="person" value={person.id} />)}
        <button type="submit" disabled={busy}>{dismissing ? "正在标记…" : "不是同一人"}</button>
      </form>
      <button type="button" className="admin-primary" disabled={busy} onClick={() => confirm.current?.showModal()}>合并到「{kept.alias ? label(kept) : kept.name}」</button>
    </div>

    <dialog ref={confirm} aria-labelledby={confirmHeading} className="admin-quick-dialog" onCancel={event => { if (merging) event.preventDefault(); }}>
      <h2 id={confirmHeading} className="text-xl font-semibold text-white">合并到「{label(kept)}」？</h2>
      <p className="my-4 text-sm leading-6 text-neutral-300">
        将把 {removed.map(label).join("、")} 的 <span className="font-mono">{movedWorks}</span> 部作品的演职关联并入「{label(kept)}」，然后删除{removed.length > 1 ? "这些人物" : "这位人物"}。
        同一作品同一职务已存在时保留原记录，只补上缺少的角色名。{!kept.alias && removed.some(person => person.alias) ? "保留的人物没有别名，会沿用被合并者的别名。" : ""}此操作无法撤销。
      </p>
      <form action={mergeAction} className="flex flex-wrap justify-end gap-3">
        <input type="hidden" name="keep" value={keep} />
        {removed.map(person => <input key={person.id} type="hidden" name="remove" value={person.id} />)}
        <button type="button" disabled={merging} onClick={() => confirm.current?.close()}>取消</button>
        <button type="submit" className="admin-primary" disabled={merging}>{merging ? "正在合并…" : "确认合并"}</button>
      </form>
      <p role="alert" className="mt-3 text-sm text-red-300">{mergeState.error}</p>
    </dialog>
  </article>;
}
