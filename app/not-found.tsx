import { BackLink } from "@/components/MediaBackLink";

/** 展示未找到页面提示，并提供返回首页的入口。 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[var(--canvas)] text-white">
      
      <div className="flex flex-col items-center gap-6 animate-fade-in px-6 text-center">
        
        <h1 className="text-7xl md:text-9xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-b from-white via-white/85 to-white/30">
          404
        </h1>

        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">
            页面未找到
          </h2>
          <p className="text-fg-muted max-w-md mx-auto text-sm md:text-base">
            你似乎来到了一个不存在的维度。该页面可能已被移除，或者你输入了错误的地址。
          </p>
        </div>

        
        <BackLink href="/" label="返回首页" className="mt-4" />
      </div>

      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-[var(--accent-soft)] blur-[120px] rounded-full pointer-events-none -z-10"></div>
    </div>
  );
}
