"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { publicMediaTypeLabel, type PublicMediaType } from "@/lib/media-types";

/** 按电影或电视节目类型生成默认返回目录链接。 */
export function DefaultMediaBackLink({ type }: { type: PublicMediaType }) {
  return <BackLink href={`/${type}`} label={`返回${publicMediaTypeLabel(type)}列表`} />;
}

/** 用统一箭头和样式渲染传入地址与标签的返回链接。 */
export function BackLink({ href, label, className = "mb-6" }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`${className} surface-control interactive-control group inline-flex w-fit items-center rounded-xl px-4 py-2 text-sm font-medium text-fg-secondary`}
    >
      <span className="mr-2 transition-transform duration-300 group-hover:-translate-x-1">←</span>
      {label}
    </Link>
  );
}

/**
 * 仅接受站内相对路径：以 `/` 开头、非协议相对（`//`）、无 scheme。
 * `base` 须精确匹配，或后接 `/`／`?`，避免 `/music` 误匹配 `/musician`。
 */
export function isSafeInternalFrom(from: string | null, ...bases: string[]): from is string {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return false;
  if (from.includes("://") || from.includes("\\")) return false;
  return bases.some((base) => from === base || from.startsWith(`${base}/`) || from.startsWith(`${base}?`));
}

/** 站内搜索／歌曲／人物来源返回；其余回退对应媒体目录。 */
export default function MediaBackLink({ type }: { type: PublicMediaType }) {
  const from = useSearchParams().get("from");
  if (isSafeInternalFrom(from, "/search")) {
    return <BackLink href={from} label="返回搜索页" />;
  }
  if (isSafeInternalFrom(from, "/music")) {
    return <BackLink href={from} label="返回歌曲" />;
  }
  if (isSafeInternalFrom(from, "/people")) {
    return <BackLink href={from} label="返回人物" />;
  }
  return <DefaultMediaBackLink type={type} />;
}
