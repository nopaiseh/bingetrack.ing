"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** 渲染可搜索的年份选择框，支持键盘定位、确认、取消及点击外部关闭。 */
export default function DashboardYearPicker({
  years,
  selectedYear,
  onSelect,
}: {
  years: Array<string | number>;
  selectedYear: string;
  onSelect: (year: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const pickerRef = useRef<HTMLDivElement>(null);
  const options = useMemo(
    /** 把年份转成字符串并按输入文本筛选，复用未变化的筛选结果。 */
    () => years.map(String).filter(/* 忽略大小写判断年份文本是否包含输入词。 */ (year) => year.toLowerCase().includes(query.toLowerCase())),
    [query, years],
  );

  useEffect(/* 注册点击外部关闭的监听，并在卸载时清理。 */ () => {
    /** 点击选择框外部时关闭列表，清空查询和键盘定位状态。 */
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return /* 移除年份选择框的外部点击监听。 */ () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /** 通知父组件选择年份，并关闭列表、清空输入和定位状态。 */
  function selectYear(year: string) {
    onSelect(year);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative" ref={pickerRef}>
      <label
        className="surface-control group flex w-35 cursor-pointer items-center gap-2 rounded-xl py-2.5 pl-4 pr-3 transition-all hover:border-white/20 hover:bg-white/10 hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]"
        onClick={/* 点击年份选择区域时展开候选列表。 */ () => setIsOpen(true)}
      >
        <span className="i-material-symbols-calendar-today-rounded inline-block size-4 text-red-500 transition-colors group-hover:text-red-400 group-hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]" aria-hidden="true" />
        <input
          type="text"
          value={isOpen ? query : selectedYear}
          onChange={/* 更新年份查询，展开列表并将键盘定位重置到首项。 */ (event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={/* 输入框获得焦点时展开年份列表。 */ () => setIsOpen(true)}
          onKeyDown={/* 用上下键定位年份、回车确认；Escape 关闭列表、清空查询并移开焦点。 */ (event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex(/* 向下移动一项，最多停在最后一个候选年份。 */ (index) => Math.min(index + 1, options.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex(/* 向上移动一项，最少停在首个候选年份。 */ (index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && activeIndex >= 0 && options[activeIndex]) {
              event.preventDefault();
              selectYear(options[activeIndex]);
            } else if (event.key === "Escape") {
              setIsOpen(false);
              setQuery("");
              setActiveIndex(-1);
              event.currentTarget.blur();
            }
          }}
          placeholder={selectedYear}
          role="combobox"
          aria-label="筛选年份"
          aria-expanded={isOpen}
          aria-controls="dashboard-year-options"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `dashboard-year-option-${activeIndex}` : undefined}
          style={{ outline: "none" }}
          className="w-full cursor-pointer bg-transparent !border-none !shadow-none font-mono text-sm text-white outline-none placeholder:text-white/50 focus-visible:outline-none"
        />
        <span className={`i-material-symbols-expand-more-rounded inline-block size-3 text-white/50 transition-transform duration-300 ${isOpen ? "rotate-180 text-white" : "group-hover:text-white"}`} aria-hidden="true" />
      </label>

      {isOpen && (
        <div className="surface-overlay absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          <div id="dashboard-year-options" role="listbox" aria-label="年份" className="custom-scrollbar flex max-h-64 flex-col overflow-y-auto p-1">
            {options.length > 0 ? options.map(/* 将候选年份渲染为支持选中态和键盘定位的选项按钮。 */ (year, index) => (
              <button
                id={`dashboard-year-option-${index}`}
                key={year}
                type="button"
                role="option"
                aria-selected={selectedYear === year}
                onMouseEnter={/* 将鼠标指向的年份设为当前活动选项。 */ () => setActiveIndex(index)}
                onClick={/* 确认点击的年份并关闭选择列表。 */ () => selectYear(year)}
                className={`w-full shrink-0 rounded-xl border-l-2 px-4 py-2.5 text-left font-mono text-sm transition-all ${
                  selectedYear === year || activeIndex === index
                    ? "surface-active border-red-500 font-bold text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                    : "border-transparent text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {year}
              </button>
            )) : (
              <div className="px-5 py-4 text-center font-mono text-sm text-white/50">无结果</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
