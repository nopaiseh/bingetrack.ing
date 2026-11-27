"use client";

import { useSearchParams } from "next/navigation";
import { BackLink } from "@/components/MediaBackLink";

/**
 * 仅接受站内相对路径：以 `/` 开头、非协议相对（`//`）、无 scheme。
 * `base` 须精确匹配，或后接 `/`／`?`，避免 `/music` 误匹配 `/musician`。
 */
function isSafeInternalFrom(from: string | null, ...bases: string[]): from is string {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return false;
  if (from.includes("://") || from.includes("\\")) return false;
  return bases.some((base) => from === base || from.startsWith(`${base}/`) || from.startsWith(`${base}?`));
}

/** 歌曲详情返回：优先搜索／来源专辑／歌曲／人物，否则音乐目录。 */
export default function SongBackLink() {
  const from = useSearchParams().get("from");
  if (isSafeInternalFrom(from, "/search")) {
    return <BackLink href={from} label="返回搜索页" />;
  }
  if (isSafeInternalFrom(from, "/albums")) {
    return <BackLink href={from} label="返回专辑" />;
  }
  if (isSafeInternalFrom(from, "/music")) {
    return <BackLink href={from} label="返回歌曲" />;
  }
  if (isSafeInternalFrom(from, "/people")) {
    return <BackLink href={from} label="返回人物" />;
  }
  return <BackLink href="/albums" label="返回音乐列表" />;
}
