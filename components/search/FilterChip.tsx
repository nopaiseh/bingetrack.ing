"use client";

/** 渲染一个已选条件标签及其移除按钮；分类与状态使用强调色，其余属性使用中性色。 */
export default function FilterChip({
  category,
  label,
  accent = false,
  onRemove,
}: {
  category: string;
  label: string;
  accent?: boolean;
  onRemove: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-white shadow-xs ${
        accent ? "border-[var(--accent-border)] bg-[var(--accent-soft)]" : "border-white/15 bg-white/10"
      }`}
    >
      <span className="text-fg-muted">{category}:</span>
      <span>{label}</span>
      <button
        type="button"
        aria-label={`移除${category}筛选：${label}`}
        onClick={onRemove}
        className="ml-0.5 rounded p-0.5 text-fg-secondary hover:bg-white/15 hover:text-white transition-colors"
      >
        <span className="i-material-symbols-close-rounded size-3 inline-block" aria-hidden="true" />
      </button>
    </span>
  );
}
