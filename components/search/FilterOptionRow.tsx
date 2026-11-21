"use client";

/** 一行筛选：左侧标题，右侧「全部」和可多选的圆角按钮；窄屏横向滚动不换行。 */
export default function FilterOptionRow({
  label,
  options,
  selected,
  onClear,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: readonly string[];
  onClear: () => void;
  onToggle: (value: string) => void;
}) {
  const isAllSelected = selected.length === 0;

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col items-start gap-3 border-b border-white/10 py-3.5 sm:flex-row sm:gap-0"
    >
      <span className="text-fg-muted mt-1.5 w-16 shrink-0 text-sm font-medium tracking-wider" aria-hidden="true">
        {label}
      </span>
      <div className="-mx-1 flex max-w-full flex-1 items-center gap-x-3 overflow-x-auto px-1 pb-0.5 [scrollbar-width:thin] sm:flex-wrap sm:gap-y-2 sm:overflow-visible sm:pb-0">
        <button
          type="button"
          aria-pressed={isAllSelected}
          onClick={/* 清除当前分类的限制。 */ onClear}
          className={`min-h-10 shrink-0 rounded-full px-4 py-1.5 text-sm transition-all duration-300 ${
            isAllSelected ? "filter-option-active" : "filter-option"
          }`}
        >
          全部
        </button>

        {options.map(
          /* 渲染分类选项按钮。 */ (option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                type="button"
                key={option.value}
                aria-pressed={isSelected}
                onClick={/* 切换分类选项。 */ () => onToggle(option.value)}
                className={`group flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all duration-300 ${
                  isSelected ? "filter-option-active" : "filter-option"
                }`}
              >
                {option.label}
                {isSelected && (
                  <span
                    className="i-material-symbols-close-rounded ml-1 inline-block size-3 opacity-60 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}
