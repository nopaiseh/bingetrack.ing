import { SkeletonBlock } from "@/components/LoadingSkeletons";

/** 歌曲详情加载骨架：与专辑页头同构。 */
export default function Loading() {
  return (
    <div className="relative text-fg" aria-busy="true" aria-label="正在加载歌曲">
      <div className="container mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        <SkeletonBlock className="mb-6 h-10 w-36 rounded-xl" />
        <div className="flex items-start gap-4 sm:gap-5">
          <SkeletonBlock className="aspect-square w-16 shrink-0 rounded-xl sm:w-24" />
          <div className="min-w-0 flex-1 space-y-3">
            <SkeletonBlock className="h-10 w-2/3 max-w-md rounded-lg" />
            <SkeletonBlock className="h-4 w-1/2 max-w-sm rounded" />
          </div>
        </div>
      </div>
      <div className="container mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 space-y-8">
        <SkeletonBlock className="h-6 w-16 rounded" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <SkeletonBlock className="h-6 w-20 rounded" />
        <SkeletonBlock className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
