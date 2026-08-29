function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/8 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="min-h-screen pb-16 pt-24">
      <div className="container mx-auto max-w-7xl space-y-6 px-6 md:px-8" aria-label="正在加载本季剧集">
        <Pulse className="h-10 w-44" />
        <div className="glass-panel flex flex-col gap-6 rounded-3xl p-8 sm:flex-row">
          <Pulse className="aspect-2/3 w-36 shrink-0 sm:w-48" />
          <div className="flex-1 space-y-4 py-2">
            <Pulse className="h-4 w-40" />
            <Pulse className="h-12 w-64 max-w-full" />
            <Pulse className="h-4 w-44" />
            <Pulse className="mt-6 h-20 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Pulse key={index} className="h-24" />)}
        </div>
        <Pulse className="h-16 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="glass-card flex h-40 overflow-hidden rounded-2xl">
              <Pulse className="h-full w-28 rounded-none sm:w-36" />
              <div className="flex-1 space-y-3 p-5">
                <Pulse className="h-5 w-2/5" />
                <Pulse className="h-3 w-1/3" />
                <Pulse className="h-4 w-full" />
                <Pulse className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
