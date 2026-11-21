"use client";

/** 滚动超过阈值后出现的回到顶部按钮。隐藏时用 inert 退出 Tab 顺序。 */
export default function SearchScrollTop({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="返回页面顶部"
      inert={!visible}
      className={`surface-muted fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] right-4 z-50 flex size-12 items-center justify-center rounded-full border border-white/10 text-fg-secondary shadow-[0_4px_15px_rgba(0,0,0,0.3)] transition-all duration-300 hover:scale-105 hover:border-[var(--accent-border-hover)] hover:bg-white/10 hover:text-[var(--accent-hover)] hover:shadow-lg hover:shadow-black/50 sm:right-8 md:bottom-22 lg:right-12 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      }`}
    >
      <span className="i-material-symbols-arrow-upward-rounded inline-block size-5" aria-hidden="true" />
    </button>
  );
}
