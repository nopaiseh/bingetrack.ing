"use client";

import { useSearchParams } from "next/navigation";
import { BackLink, isSafeInternalFrom } from "@/components/MediaBackLink";

/** 人物页返回：优先搜索或来源歌曲／媒体详情，否则搜索页。 */
export default function PersonBackLink() {
  const from = useSearchParams().get("from");
  if (isSafeInternalFrom(from, "/search")) {
    return <BackLink href={from} label="返回搜索页" />;
  }
  if (isSafeInternalFrom(from, "/music")) {
    return <BackLink href={from} label="返回歌曲" />;
  }
  if (isSafeInternalFrom(from, "/albums", "/movies", "/shows", "/books")) {
    return <BackLink href={from} label="返回作品" />;
  }
  return <BackLink href="/search" label="返回搜索页" />;
}
