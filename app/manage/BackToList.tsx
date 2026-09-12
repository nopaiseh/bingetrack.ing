"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rememberedList } from "@/lib/admin/navigation";
/** 返回本分类上次的搜索与分页，不丢失连续编辑的位置。 */
export default function BackToList({ category }: { category: string }) {
  const router = useRouter();
  const fallback = category === "movie" || category.startsWith("tv_") ? `/manage?type=${category}` : `/manage/references/${category}`;
  return <Link href={fallback} className="mb-4 inline-block text-sm text-white/60 hover:text-white transition-colors" onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); router.push(rememberedList(category, fallback)); }}>← 返回列表</Link>;
}
