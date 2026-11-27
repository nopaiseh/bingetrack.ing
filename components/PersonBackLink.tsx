"use client";

import { useSearchParams } from "next/navigation";
import { BackLink } from "@/components/MediaBackLink";

/** 人物页返回：优先搜索或来源歌曲／媒体详情，否则搜索页。 */
export default function PersonBackLink() {
  const from = useSearchParams().get("from");
  if (from === "/search" || from?.startsWith("/search?")) {
    return <BackLink href={from} label="返回搜索页" />;
  }
  if (from?.startsWith("/music/")) {
    return <BackLink href={from} label="返回歌曲" />;
  }
  if (
    from?.startsWith("/albums/") ||
    from?.startsWith("/movies/") ||
    from?.startsWith("/shows/") ||
    from?.startsWith("/books/")
  ) {
    return <BackLink href={from} label="返回作品" />;
  }
  return <BackLink href="/search" label="返回搜索页" />;
}
