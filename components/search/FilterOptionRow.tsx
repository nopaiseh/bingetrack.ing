"use client";

/** 一行筛选：左侧标题，右侧「全部」和可多选的圆角按钮。 */
export default function FilterOptionRow({
  label,
  options,
  selected,
  onClear,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onClear: () => void;
  onToggle: (value: string) => void;
}) {
  const isAllSelected = selected.length === 0;

  return (
    <div className="flex flex-col items-start gap-3 border-b border-white/10 py-3.5 sm:flex-row sm:gap-0">
      <span className="text-fg-muted text-sm font-medium w-16 shrink-0 mt-1.5 tracking-wider">
        {label}
      </span>
      <div className="flex flex-wrap gap-x-3 gap-y-2 flex-1 items-center">
        <button
          aria-pressed={isAllSelected}
          onClick={/* 清除当前分类的限制。 */ onClear}
          className={`min-h-10 rounded-full px-4 py-1.5 text-sm transition-all duration-300 backdrop-blur-2xl ${
            isAllSelected
              ? "filter-option-active"
              : "filter-option"
          }`}
        >
          全部
        </button>

        {options.map(/* 渲染分类选项按钮。 */ (option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              aria-pressed={isSelected}
              onClick={/* 切换分类选项。 */ () => onToggle(option.value)}
              className={`group flex min-h-10 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all duration-300 backdrop-blur-2xl ${
                isSelected
                  ? "filter-option-active"
                  : "filter-option"
              }`}
            >
              {option.label}
              {isSelected && (
                <span className="i-material-symbols-close-rounded ml-1 inline-block size-3 opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
