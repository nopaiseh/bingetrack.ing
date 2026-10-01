import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reports } from "@/lib/admin/reports";
import StatusModal from "../StatusModal";
import SimilarPeopleGroup, { type SimilarPerson } from "./SimilarPeopleGroup";

/** 一次最多处理的人物数；疑似重复通常只有几组，超出时提示先处理前面的。 */
const LIMIT = 300;

/** 疑似重复人物按写法分组显示，每组可合并或标记为不是同一人。 */
export default async function SimilarPeopleReport({ db, merged, dismissed, nonce }: { db: SupabaseClient; merged?: string; dismissed?: string; nonce?: string }) {
  const config = reports["similar-people"];
  const { data, count, error } = await db.from(config.view).select("link_id,title,detail,group_key", { count: "exact" }).order("sort_key").order("id").limit(LIMIT);
  if (error) throw new Error("无法读取报告，请确认数据库迁移已应用后重试。");
  const rows = (data ?? []) as { link_id: string; title: string; detail: string; group_key: string }[];
  const ids = rows.map(row => row.link_id);
  const credits = ids.length ? await db.from("media_credits").select("person_id,media_item_id").in("person_id", ids) : { data: [], error: null };
  if (credits.error) throw new Error("无法读取人物的作品数量，请重试。");
  const works = new Map<string, Set<string>>();
  for (const credit of (credits.data ?? []) as { person_id: string; media_item_id: string }[]) works.set(credit.person_id, (works.get(credit.person_id) ?? new Set()).add(credit.media_item_id));
  const groups = new Map<string, SimilarPerson[]>();
  for (const row of rows) groups.set(row.group_key, [...(groups.get(row.group_key) ?? []), { id: row.link_id, name: row.title, alias: row.detail === "未填别名" ? null : row.detail, works: works.get(row.link_id)?.size ?? 0 }]);

  return <section>
    <Link href="/manage/reports" className="mb-2 inline-block text-sm text-neutral-400 hover:text-white transition-colors">← 全部报告</Link>
    <div className="surface-panel mb-8 rounded-3xl p-5 sm:p-8">
      <h1 className="admin-heading">{config.label}</h1>
      <p className="mt-2 text-neutral-400">共 {groups.size} 组、{count ?? 0} {config.unit} · 合并后删除重复的人物；不是同一人的标记后不再出现。</p>
    </div>
    {merged && <StatusModal key={nonce} message={`已合并并删除 ${Number(merged) || 0} 位人物。`} />}
    {dismissed && <StatusModal key={nonce} message="已标记为不是同一人，这组不会再出现。" />}
    {groups.size > 0 ? <div className="space-y-5">{[...groups].map(([key, people]) => <SimilarPeopleGroup key={key} people={people} />)}</div>
      : <div className="surface-panel rounded-2xl px-6 py-16 text-center"><span className="i-material-symbols-check-circle-outline-rounded mx-auto mb-3 block size-8 text-[var(--accent)]" aria-hidden="true" /><p className="text-neutral-400">没有疑似重复的人物。</p></div>}
    {(count ?? 0) > LIMIT && <p className="mt-6 text-sm text-neutral-400">只显示前 {LIMIT} 位人物，处理后刷新即可看到其余的。</p>}
  </section>;
}
