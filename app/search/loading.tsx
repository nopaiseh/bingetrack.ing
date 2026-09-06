import { SearchMediaCardSkeleton } from "@/components/SearchMediaCard";

/** 用搜索框、筛选区和十二张卡片占位展示搜索页加载状态。 */
export default function SearchLoading() {
  return (
    <div className="container mx-auto w-full max-w-7xl px-4 pb-12 pt-28 sm:px-6 lg:px-8" aria-busy="true" aria-label="正在加载搜索结果">
      <div className="surface-muted mb-6 h-14 animate-pulse rounded-xl" />
      <div className="surface-muted mb-8 h-48 animate-pulse rounded-xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, /* 为搜索页生成一张带稳定索引键的卡片骨架。 */ (_, index) => <SearchMediaCardSkeleton key={index} />)}
      </div>
    </div>
  );
}
