"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** 按电影或电视剧类型生成默认返回目录链接。 */
export function DefaultMediaBackLink({ type }: { type: "movies" | "series" }) {
  return <BackLink href={`/${type}`} label={type === "series" ? "返回电视剧列表" : "返回电影列表"} />;
}

/** 用统一箭头和样式渲染传入地址与标签的返回链接。 */
function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="surface-control interactive-control group mb-6 inline-flex w-fit items-center rounded-xl px-4 py-2 text-sm font-medium text-white/70">
      <span className="mr-2 transition-transform duration-300 group-hover:-translate-x-1">←</span>
      {label}
    </Link>
  );
}

/** 仅接受站内搜索页作为来源返回地址，其余情况返回对应媒体目录。 */
export default function MediaBackLink({ type }: { type: "movies" | "series" }) {
  const from = useSearchParams().get("from");
  return from === "/search" || from?.startsWith("/search?")
    ? <BackLink href={from} label="返回搜索页" />
    : <DefaultMediaBackLink type={type} />;
}
