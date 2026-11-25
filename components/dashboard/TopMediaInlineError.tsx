/** 年度精选加载失败时的行内提示，样式与看板既有错误条一致，附带重试。 */
export default function TopMediaInlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-red-400/40 px-3 py-1 text-red-100 transition-colors hover:bg-red-500/20"
      >
        重试
      </button>
    </div>
  );
}
