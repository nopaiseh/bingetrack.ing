import { SearchMediaCardSkeleton } from "@/components/SearchMediaCard";

/** 用搜索框、筛选区和十二张卡片占位展示搜索页加载状态。 */
export default function SearchLoading() {
  return (
    <div className="container mx-auto w-full max-w-7xl px-4 pb-8 pt-24 sm:px-6 md:pb-12 lg:px-8" aria-busy="true" aria-label="正在加载搜索结果">
      <h1 className="sr-only">搜索结果</h1>
      <div className="shimmer-wave mb-3 h-10 w-64 max-w-full rounded-xl" />
      <div className="shimmer-wave mb-6 h-4 w-28 rounded-md" />
      <div className="mb-4 flex gap-2">
        <div className="shimmer-wave h-14 flex-1 rounded-2xl" />
        <div className="shimmer-wave h-14 w-24 rounded-xl" />
      </div>
      <div className="shimmer-wave mb-8 h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }, /* 为搜索页生成一张带稳定索引键的卡片骨架。 */ (_, index) => <SearchMediaCardSkeleton key={index} />)}
      </div>
    </div>
  );
}
