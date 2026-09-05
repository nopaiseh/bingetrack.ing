import { SearchMediaCardSkeleton } from "@/components/SearchMediaCard";

export default function SearchLoading() {
  return (
    <div className="container mx-auto w-full max-w-7xl px-4 pb-12 pt-28 sm:px-6 lg:px-8" aria-busy="true" aria-label="正在加载搜索结果">
      <div className="surface-muted mb-6 h-14 animate-pulse rounded-xl" />
      <div className="surface-muted mb-8 h-48 animate-pulse rounded-xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => <SearchMediaCardSkeleton key={index} />)}
      </div>
    </div>
  );
}
