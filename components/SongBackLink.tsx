"use client";

import { useSearchParams } from "next/navigation";
import { BackLink } from "@/components/MediaBackLink";

/** 歌曲详情返回：优先回到搜索或来源专辑，否则音乐目录。 */
export default function SongBackLink() {
  const from = useSearchParams().get("from");
  if (from === "/search" || from?.startsWith("/search?")) {
    return <BackLink href={from} label="返回搜索页" />;
  }
  if (from?.startsWith("/albums/")) {
    return <BackLink href={from} label="返回专辑" />;
  }
  return <BackLink href="/albums" label="返回音乐列表" />;
}
