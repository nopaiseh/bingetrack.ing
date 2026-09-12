/** 按传入样式渲染带微光波浪动效的统一占位块。 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`shimmer-wave rounded-xl ${className}`} />;
}

/** 模拟海报卡片的图片、标题及辅助信息布局。 */
function PosterSkeleton() {
  return (
    <div className="surface-card w-36 shrink-0 overflow-hidden rounded-xl sm:w-44">
      <SkeletonBlock className="aspect-2/3 w-full rounded-none" />
      <div className="space-y-2 p-3">
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/** 为一个媒体横向列表提供标题栏和六张海报骨架。 */
export function PosterRowSkeleton() {
  return (
    <section className="space-y-5 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <SkeletonBlock className="h-6 w-28" />
        <SkeletonBlock className="h-4 w-16" />
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 6 }, /* 为横向列表生成一张带索引键的海报骨架。 */ (_, index) => <PosterSkeleton key={index} />)}
      </div>
    </section>
  );
}

/** 为媒体目录展示四项统计和两排海报占位。 */
export function CatalogLoadingSkeleton() {
  return (
    <section className="container mx-auto max-w-7xl px-4 pb-12 pt-26 sm:px-6 lg:px-8" aria-label="正在加载媒体目录">
      <div className="mb-10 grid grid-cols-2 gap-4 md:mb-12 lg:mb-16 lg:grid-cols-4">
        {Array.from({ length: 4 }, /* 为一项目录统计渲染标签和数字占位。 */ (_, index) => (
          <div key={index} className="surface-card space-y-3 rounded-2xl p-4 sm:p-5 lg:p-6">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-12">
        <PosterRowSkeleton />
        <PosterRowSkeleton />
      </div>
    </section>
  );
}

/** 为首页标题、统计、图表和媒体列表展示加载骨架。 */
export function HomeLoadingSkeleton() {
  return (
    <section className="container mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-12 pt-24 sm:px-6 lg:px-8" aria-label="正在加载首页">
      <SkeletonBlock className="h-14 w-72 max-w-full" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, /* 为首页统计区域生成一个占位块。 */ (_, index) => <SkeletonBlock key={index} className="h-40" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
      <PosterRowSkeleton />
    </section>
  );
}

/** 为媒体详情的海报、标题、属性和底部内容展示加载骨架。 */
export function DetailLoadingSkeleton() {
  return (
    <section className="container mx-auto max-w-7xl px-4 pb-12 pt-24 sm:px-6 lg:px-8" aria-label="正在加载媒体详情">
      <div className="flex flex-col gap-12 lg:flex-row lg:gap-20">
        <div className="w-full shrink-0 space-y-6 lg:w-72">
          <SkeletonBlock className="h-10 w-28" />
          <SkeletonBlock className="aspect-2/3 w-full" />
        </div>
        <div className="flex-1 space-y-6 pt-8">
          <SkeletonBlock className="h-12 w-3/4" />
          <SkeletonBlock className="h-8 w-52" />
          {Array.from({ length: 5 }, /* 为一行详情属性生成全宽占位块。 */ (_, index) => <SkeletonBlock key={index} className="h-12 w-full" />)}
        </div>
      </div>
      <SkeletonBlock className="mt-12 h-48 w-full" />
    </section>
  );
}

/** 在相关媒体尚未加载时展示一排海报骨架。 */
export function RelatedMediaLoadingSkeleton() {
  return (
    <div className="pb-12">
      <PosterRowSkeleton />
    </div>
  );
}

/** 为后台管理页面提供头部、表单与条目列表骨架。 */
export function AdminLoadingSkeleton() {
  return (
    <section className="container mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8" aria-label="正在加载管理后台">
      <div className="surface-panel mb-8 rounded-3xl p-5 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-36" />
          <SkeletonBlock className="h-4 w-52" />
        </div>
        <SkeletonBlock className="h-10 w-28 rounded-xl" />
      </div>

      <div className="surface-panel mb-6 rounded-2xl p-4 sm:p-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <SkeletonBlock className="h-11 w-full rounded-xl" />
        <SkeletonBlock className="h-11 w-20 rounded-xl" />
      </div>

      <div className="surface-panel divide-y divide-white/10 overflow-hidden rounded-2xl">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <SkeletonBlock className="h-16 w-11 shrink-0 rounded-md" />
              <div className="space-y-2 min-w-0">
                <SkeletonBlock className="h-5 w-48 max-w-full" />
                <SkeletonBlock className="h-3 w-32" />
              </div>
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** 为电视剧分季详情页面提供海报、统计与分集列表骨架。 */
export function SeasonDetailLoadingSkeleton() {
  return (
    <div className="min-h-screen pb-16 pt-24">
      <section className="container mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8" aria-label="正在加载本季剧集">
        <SkeletonBlock className="h-10 w-44" />
        <div className="surface-panel flex flex-col gap-6 rounded-3xl p-5 sm:p-6 lg:flex-row lg:p-8">
          <SkeletonBlock className="aspect-2/3 w-full max-w-72 shrink-0 self-center lg:w-72 lg:self-start" />
          <div className="flex-1 space-y-4 py-2">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-12 w-64 max-w-full" />
            <SkeletonBlock className="h-4 w-44" />
            <SkeletonBlock className="mt-6 h-20 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-24" />)}
        </div>
        <SkeletonBlock className="h-16 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="surface-card flex flex-col overflow-hidden rounded-2xl sm:h-64 sm:flex-row">
              <SkeletonBlock className="aspect-video w-full shrink-0 rounded-none sm:aspect-auto sm:h-full sm:w-80 md:w-96" />
              <div className="flex-1 space-y-3 p-5">
                <SkeletonBlock className="h-5 w-2/5" />
                <SkeletonBlock className="h-3 w-1/3" />
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
