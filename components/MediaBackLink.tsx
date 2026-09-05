"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function DefaultMediaBackLink({ type }: { type: "movies" | "series" }) {
  return <BackLink href={`/${type}`} label={type === "series" ? "返回电视剧列表" : "返回电影列表"} />;
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="surface-control interactive-control group mb-6 inline-flex w-fit items-center rounded-xl px-4 py-2 text-sm font-medium text-white/70">
      <span className="mr-2 transition-transform duration-300 group-hover:-translate-x-1">←</span>
      {label}
    </Link>
  );
}

export default function MediaBackLink({ type }: { type: "movies" | "series" }) {
  const from = useSearchParams().get("from");
  return from === "/search" || from?.startsWith("/search?")
    ? <BackLink href={from} label="返回搜索页" />
    : <DefaultMediaBackLink type={type} />;
}
