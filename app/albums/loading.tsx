import { SkeletonBlock } from "@/components/LoadingSkeletons";

/** 专辑目录加载骨架：五项统计 + 封面墙方格。 */
export default function Loading() {
  return (
    <>
      <h1 className="sr-only">专辑</h1>
      <div className="relative text-fg pt-14" aria-busy="true" aria-label="正在加载专辑">
        <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 md:pb-12 lg:px-8">
          <div className="mb-8 grid grid-cols-2 gap-3.5 sm:gap-4 md:mb-10 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className={`surface-card space-y-3 rounded-xl p-3.5 sm:p-4.5 ${index === 4 ? "max-md:col-span-2" : ""}`}
              >
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-8 w-14" />
              </div>
            ))}
          </div>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {Array.from({ length: 18 }, (_, index) => (
              <li key={index} className="min-w-0 space-y-1.5">
                <SkeletonBlock className="aspect-square w-full rounded-lg" />
                <SkeletonBlock className="h-3 w-4/5 rounded" />
                <SkeletonBlock className="h-3 w-2/5 rounded" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
