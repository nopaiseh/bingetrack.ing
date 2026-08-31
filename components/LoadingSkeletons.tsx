function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/8 ${className}`} />;
}

function PosterSkeleton() {
  return (
    <div className="glass-card w-36 shrink-0 overflow-hidden rounded-xl sm:w-44">
      <Pulse className="aspect-2/3 w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Pulse className="h-4 w-3/4" />
        <Pulse className="h-3 w-full" />
        <Pulse className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function PosterRowSkeleton() {
  return (
    <section className="space-y-5 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <Pulse className="h-6 w-28" />
        <Pulse className="h-4 w-16" />
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 6 }, (_, index) => <PosterSkeleton key={index} />)}
      </div>
    </section>
  );
}

export function CatalogLoadingSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-4 pb-12 pt-26 sm:px-6 lg:px-8" aria-label="正在加载媒体目录">
      <div className="mb-10 grid grid-cols-2 gap-4 md:mb-12 lg:mb-16 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="glass-card space-y-3 rounded-2xl p-4 sm:p-5 lg:p-6">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-12">
        <PosterRowSkeleton />
        <PosterRowSkeleton />
      </div>
    </div>
  );
}

export function HomeLoadingSkeleton() {
  return (
    <div className="container mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-12 pt-24 sm:px-6 lg:px-8" aria-label="正在加载首页">
      <Pulse className="h-14 w-72 max-w-full" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <Pulse key={index} className="h-40" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Pulse className="h-72" />
        <Pulse className="h-72" />
      </div>
      <PosterRowSkeleton />
    </div>
  );
}

export function DetailLoadingSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-4 pb-12 pt-24 sm:px-6 lg:px-8" aria-label="正在加载媒体详情">
      <div className="flex flex-col gap-12 lg:flex-row lg:gap-20">
        <div className="w-full shrink-0 space-y-6 lg:w-72">
          <Pulse className="h-10 w-28" />
          <Pulse className="aspect-2/3 w-full" />
        </div>
        <div className="flex-1 space-y-6 pt-8">
          <Pulse className="h-12 w-3/4" />
          <Pulse className="h-8 w-52" />
          {Array.from({ length: 5 }, (_, index) => <Pulse key={index} className="h-12 w-full" />)}
        </div>
      </div>
      <Pulse className="mt-12 h-48 w-full" />
    </div>
  );
}

export function RelatedMediaLoadingSkeleton() {
  return (
    <div className="pb-12">
      <PosterRowSkeleton />
    </div>
  );
}
