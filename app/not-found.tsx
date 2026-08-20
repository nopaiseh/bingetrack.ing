import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#0a0a0a] text-white">
      
      <div className="flex flex-col items-center gap-6 animate-fade-in px-6 text-center">
        
        <h1 className="text-7xl md:text-9xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-red-500 to-red-700 drop-shadow-[0_0_24px_rgba(239,68,68,0.4)]">
          404
        </h1>

        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">
            页面未找到
          </h2>
          <p className="text-neutral-400 max-w-md mx-auto text-sm md:text-base">
            你似乎来到了一个不存在的维度。该页面可能已被移除，或者你输入了错误的地址。
          </p>
        </div>

        
        <Link 
          href="/" 
          className="mt-4 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-300 rounded-xl text-sm font-medium group"
        >
          <i className="fas fa-arrow-left mr-2 text-neutral-500 group-hover:text-red-400 transition-colors"></i>
          返回首页
        </Link>
      </div>

      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-red-500/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
    </div>
  );
}