import BooksCatalog from "./BooksCatalog";
import { getCachedBookStats } from "@/lib/functions/cached-media";
import { fetchMediaCardsServer } from "@/lib/functions/media-repo";
import { handlePageDataError } from "@/lib/functions/page-data";
import type { MediaCard } from "@/lib/types";
import { buildPageSocialMetadata } from "@/lib/seo/page";

export const metadata = {
  ...buildPageSocialMetadata("图书", "浏览在读、读过与想读的图书记录。", "/books"),
  alternates: { canonical: "/books" },
};

// 图书目录无数据缓存标签，只靠管理端 revalidatePath("/books") 按需刷新。
export const revalidate = false;

const DEFAULT_STATS = { total: 0, reading: 0, read: 0, want: 0 };

/** 并行读取图书统计与在读／读过／想读卡片；构建期失败时降级为空目录。 */
export default async function BooksPage() {
  let stats = DEFAULT_STATS;
  let reading: MediaCard[] = [];
  let read: MediaCard[] = [];
  let want: MediaCard[] = [];

  try {
    const [bookStats, readingCards, readCards, wantCards] = await Promise.all([
      getCachedBookStats(),
      fetchMediaCardsServer({ type: "book", status: "in_progress", limit: 10, offset: 0, sort: "date_desc" }),
      fetchMediaCardsServer({ type: "book", status: "watched", limit: 10, offset: 0, sort: "date_desc" }),
      fetchMediaCardsServer({ type: "book", status: "want_to_watch", limit: 10, offset: 0, sort: "date_desc" }),
    ]);
    stats = {
      total: bookStats.total,
      reading: bookStats.inProgress,
      read: bookStats.watched,
      want: bookStats.wantToWatch,
    };
    reading = readingCards;
    read = readCards;
    want = wantCards;
  } catch (error) {
    handlePageDataError("books page", error);
  }

  return <BooksCatalog reading={reading} read={read} want={want} stats={stats} />;
}
