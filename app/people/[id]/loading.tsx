import { SkeletonBlock } from "@/components/LoadingSkeletons";

/** 人物页加载骨架。 */
export default function Loading() {
  return (
    <div className="relative text-fg" aria-busy="true" aria-label="正在加载人物">
      <div className="container mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        <SkeletonBlock className="mb-6 h-10 w-36 rounded-xl" />
        <div className="flex items-center gap-4 sm:gap-5">
          <SkeletonBlock className="aspect-square w-20 shrink-0 rounded-full sm:w-24" />
          <SkeletonBlock className="h-10 w-48 max-w-md rounded-lg" />
        </div>
      </div>
      <div className="container mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 space-y-6">
        <SkeletonBlock className="h-7 w-20 rounded" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className="aspect-2/3 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
