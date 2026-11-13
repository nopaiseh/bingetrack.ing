import { SearchMediaCardSkeleton } from "@/components/SearchMediaCard";

/** 用搜索框、筛选区和十二张卡片占位展示搜索页加载状态。 */
export default function SearchLoading() {
  return (
    <div className="container mx-auto w-full max-w-7xl px-4 pb-8 pt-24 sm:px-6 md:pb-12 lg:px-8" aria-busy="true" aria-label="正在加载搜索结果">
      <h1 className="sr-only">搜索结果</h1>
      <div className="shimmer-wave mb-6 h-14 rounded-2xl" />
      <div className="shimmer-wave mb-8 h-11 w-28 rounded-xl md:hidden" />
      <div className="shimmer-wave mb-8 hidden h-48 rounded-2xl md:block" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, /* 为搜索页生成一张带稳定索引键的卡片骨架。 */ (_, index) => <SearchMediaCardSkeleton key={index} />)}
      </div>
    </div>
  );
}
