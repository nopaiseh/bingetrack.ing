"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** 按电影或电视节目类型生成默认返回目录链接。 */
export function DefaultMediaBackLink({ type }: { type: "movies" | "shows" }) {
  return <BackLink href={`/${type}`} label={type === "shows" ? "返回电视节目列表" : "返回电影列表"} />;
}

/** 用统一箭头和样式渲染传入地址与标签的返回链接。 */
export function BackLink({ href, label, className = "mb-6" }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} className={`${className} surface-control interactive-control group inline-flex w-fit items-center rounded-xl px-4 py-2 text-sm font-medium text-fg-secondary`}>
      <span className="mr-2 transition-transform duration-300 group-hover:-translate-x-1">←</span>
      {label}
    </Link>
  );
}

/** 仅接受站内搜索页作为来源返回地址，其余情况返回对应媒体目录。 */
export default function MediaBackLink({ type }: { type: "movies" | "shows" }) {
  const from = useSearchParams().get("from");
  return from === "/search" || from?.startsWith("/search?")
    ? <BackLink href={from} label="返回搜索页" />
    : <DefaultMediaBackLink type={type} />;
}
