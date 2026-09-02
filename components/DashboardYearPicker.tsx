"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

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
    () => years.map(String).filter((year) => year.toLowerCase().includes(query.toLowerCase())),
    [query, years],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        onClick={() => setIsOpen(true)}
      >
        <CalendarDays className="size-4 text-red-500 transition-colors group-hover:text-red-400 group-hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]" aria-hidden="true" />
        <input
          type="text"
          value={isOpen ? query : selectedYear}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((index) => Math.min(index + 1, options.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
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
          className="w-full cursor-pointer bg-transparent font-mono text-sm text-white/90 outline-none placeholder:text-white/40 focus-visible:outline-none"
        />
        <ChevronDown className={`size-3 text-white/50 transition-transform duration-300 ${isOpen ? "rotate-180 text-white" : "group-hover:text-white"}`} aria-hidden="true" />
      </label>

      {isOpen && (
        <div className="surface-panel absolute right-0 top-full z-50 mt-2 w-32 overflow-hidden rounded-xl animate-in fade-in slide-in-from-top-2">
          <div id="dashboard-year-options" role="listbox" aria-label="年份" className="custom-scrollbar flex max-h-64 flex-col overflow-y-auto">
            {options.length > 0 ? options.map((year, index) => (
              <button
                id={`dashboard-year-option-${index}`}
                key={year}
                type="button"
                role="option"
                aria-selected={selectedYear === year}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectYear(year)}
                className={`w-full shrink-0 border-l-2 px-5 py-3 text-left font-mono text-sm transition-colors ${
                  selectedYear === year || activeIndex === index
                    ? "surface-active border-red-400 font-bold text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.3)]"
                    : "border-transparent text-white/60 hover:bg-white/10 hover:text-white"
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
