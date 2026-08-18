"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { getSupabaseBrowser } from "@/utils/supabase-client";

// DROPDOWN CATEGORIES (Long lists) remain outside as they are static
const DROPDOWN_CATEGORIES = [
  {
    id: "region",
    label: "地区",
    options: ["大陆", "香港", "台湾", "美国", "韩国", "日本", "欧美", "英国", "法国", "泰国", "印度", "加拿大", "西班牙", "德国", "俄罗斯", "新加坡"],
  },
  {
    id: "language",
    label: "语言",
    options: ["国语", "英语", "日语", "粤语", "韩语", "法语", "西班牙语", "泰语", "德语", "意大利语", "俄语", "印地语", "其它"],
  },
  {
    id: "year",
    label: "年份",
    options: ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012"],
  },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const [genreOptions, setGenreOptions] = useState<string[]>([]);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);

  const [filters, setFilters] = useState<Record<string, string[]>>({
    mediaType: [],
    genre: [],
    sort: ["最近更新"], 
    region: [],
    language: [],
    year: [],
  });

  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchGenres = async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("genres")
        .select("name")
        .order("name", { ascending: true });

      if (data && !error) {
        setGenreOptions(data.map((g) => g.name));
      } else if (error) {
        console.error("Error fetching genres:", error.message);
      }
    };

    fetchGenres();

    const fetchRegions = async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("regions")
        .select("name")
        .order("name", { ascending: true });

      if (data && !error) {
        setRegionOptions(data.map((r) => r.name));
      } else if (error) {
        console.error("Error fetching regions:", error.message);
      }
    };

    fetchRegions();
  }, []);

  const BUTTON_CATEGORIES = [
    {
      id: "mediaType",
      label: "分类",
      options: ["电影", "电视剧", "剧季", "剧集"],
      multiSelect: true,
    },
    {
      id: "genre",
      label: "类型",
      options: genreOptions,
      multiSelect: true,
    },
    {
      id: "region",
      label: "地区",
      options: regionOptions,
      multiSelect: true,
    },
    {
      id: "sort",
      label: "排序",
      options: ["最近更新", "最多播放", "最高评分"],
      multiSelect: false,
    },
  ];

  const toggleFilter = (categoryId: string, value: string, isMultiSelect = true) => {
    setFilters((prev) => {
      const currentSelected = prev[categoryId] || [];

      if (value === "全部") {
        return { ...prev, [categoryId]: [] }; 
      }

      if (!isMultiSelect) {
        return { ...prev, [categoryId]: [value] };
      }

      if (currentSelected.includes(value)) {
        return { ...prev, [categoryId]: currentSelected.filter((item) => item !== value) };
      } else {
        return { ...prev, [categoryId]: [...currentSelected, value] };
      }
    });
  };

  const addCustomInput = (categoryId: string) => {
    const val = (customInputs[categoryId] || "").trim();
    if (!val) return;

    setFilters((prev) => {
      const currentSelected = prev[categoryId] || [];
      if (currentSelected.includes(val)) return prev;
      return { ...prev, [categoryId]: [...currentSelected, val] };
    });

    setCustomInputs((prev) => ({ ...prev, [categoryId]: "" }));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, categoryId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomInput(categoryId);
    }
  };

  const hasActiveFilters = Object.entries(filters).some(([key, arr]) => {
    if (key === "sort") return arr[0] !== "最近更新";
    return arr.length > 0;
  });

  return (
    <div className="min-h-screen bg-[#060606] text-neutral-200 pt-24 pb-12 selection:bg-red-500/30 selection:text-white">
      
      {openDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
      )}

      <div className="container mx-auto px-6 md:px-8 max-w-7xl">
        
        <div className="mb-8">
          {/* Main Search Bar */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <i className="fas fa-search text-neutral-500 group-focus-within:text-red-500 transition-colors"></i>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索电影、电视剧、导演或演员..."
              className="w-full bg-white/5 border border-white/10 focus:border-red-500/50 rounded-2xl py-5 pl-12 pr-40 text-lg text-white placeholder:text-neutral-600 outline-none transition-all shadow-inner focus:bg-white/[0.07]"
            />
            
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-3">
              {query && (
                <button onClick={() => setQuery("")} className="text-neutral-500 hover:text-white transition-colors">
                  <i className="fas fa-times-circle"></i>
                </button>
              )}
              <div className="h-6 w-px bg-white/10"></div>
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  showAdvanced 
                    ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                    : "bg-white/5 text-neutral-400 border border-white/5 hover:bg-white/10 hover:text-white"
                }`}
              >
                <i className="fas fa-sliders-h"></i>
                {showAdvanced ? "收起筛选" : "高级筛选"}
                {!showAdvanced && hasActiveFilters && (
                  <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#060606]"></span>
                )}
              </button>
            </div>
          </div>

          {/* Expandable Advanced Filters Panel */}
          {showAdvanced && (
            <div className="mt-4 p-6 bg-[#161822] border border-white/5 rounded-2xl shadow-xl transition-all duration-300 origin-top animate-in slide-in-from-top-2 fade-in">
              <div className="flex flex-col">
                
                {/* --- PART 1: EXPOSED BUTTON ROWS --- */}
                {BUTTON_CATEGORIES.map((category) => {
                  const activeSelections = filters[category.id] || [];
                  const isAllSelected = activeSelections.length === 0;
                  const customActiveOptions = activeSelections.filter((val) => !category.options.includes(val));
                  const renderOptions = [...category.options, ...customActiveOptions];

                  return (
                    <div key={category.id} className="flex items-start py-4 border-b border-white/5 border-dashed">
                      <span className="text-neutral-400 text-sm font-medium w-16 shrink-0 mt-1.5">{category.label}</span>
                      <div className="flex flex-wrap gap-x-4 gap-y-3 flex-1 items-center">
                        <button
                          onClick={() => toggleFilter(category.id, "全部", category.multiSelect)}
                          className={`px-4 py-1.5 rounded-md text-[13px] transition-colors duration-200 ${
                            isAllSelected ? "bg-red-500 text-white font-bold" : "text-neutral-300 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          全部
                        </button>
                        {renderOptions.map((option) => {
                          const isSelected = activeSelections.includes(option);
                          return (
                            <button
                              key={option}
                              onClick={() => toggleFilter(category.id, option, category.multiSelect)}
                              className={`group flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all duration-200 ${
                                isSelected ? "bg-red-500 text-white font-bold shadow-[0_0_12px_rgba(239,68,68,0.25)]" : "text-neutral-300 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              {option}
                              {isSelected && <i className="fas fa-times text-[10px] opacity-70 group-hover:opacity-100 transition-opacity"></i>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* --- PART 2: DROPDOWN ROWS (Side-by-side) --- */}
                <div className="flex flex-wrap items-center gap-6 pt-6">
                  {DROPDOWN_CATEGORIES.map((category) => {
                    const activeSelections = filters[category.id] || [];
                    const isOpen = openDropdown === category.id;
                    const customActiveOptions = activeSelections.filter((val) => !category.options.includes(val));
                    const renderOptions = [...category.options, ...customActiveOptions];

                    return (
                      <div key={category.id} className="relative z-50 flex items-center gap-3">
                        <span className="text-neutral-400 text-sm font-medium">{category.label}</span>
                        
                        {/* Dropdown Trigger */}
                        <button
                          onClick={() => setOpenDropdown(isOpen ? null : category.id)}
                          className={`flex items-center justify-between min-w-[160px] max-w-[240px] px-4 py-2 rounded-lg border text-sm transition-colors ${
                            isOpen 
                              ? "bg-white/10 border-red-500/50 text-white" 
                              : activeSelections.length > 0
                                ? "bg-red-500/10 border-red-500/30 text-red-500"
                                : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
                          }`}
                        >
                          <span className="truncate pr-4">
                            {activeSelections.length === 0 ? "全部" : activeSelections.join(", ")}
                          </span>
                          <i className={`fas fa-chevron-down text-[10px] transition-transform duration-300 ${isOpen ? "rotate-180 text-red-500" : ""}`}></i>
                        </button>

                        {/* Dropdown Menu Panel */}
                        {isOpen && (
                          <div className="absolute top-full left-0 md:left-12 mt-2 w-56 bg-[#1a1c26] border border-white/10 rounded-xl shadow-2xl p-2 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                            
                            {/* Option List (Scrollable) */}
                            <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar">
                              
                              <button
                                onClick={() => { toggleFilter(category.id, "全部", true); setOpenDropdown(null); }}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                                  activeSelections.length === 0 ? "text-red-500 font-medium" : "text-neutral-300 hover:bg-white/5"
                                }`}
                              >
                                <i className={`fa-fw text-lg ${activeSelections.length === 0 ? "fas fa-check-circle text-red-500" : "far fa-circle text-neutral-500"}`}></i>
                                全部 (All)
                              </button>

                              <div className="h-px bg-white/10 my-1 mx-2"></div>

                              {renderOptions.map((option) => {
                                const isSelected = activeSelections.includes(option);
                                return (
                                  <button
                                    key={option}
                                    onClick={() => toggleFilter(category.id, option, true)}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                                      isSelected ? "text-white bg-white/5" : "text-neutral-300 hover:bg-white/5"
                                    }`}
                                  >
                                    <i className={`fa-fw text-lg ${isSelected ? "fas fa-check-square text-red-500" : "far fa-square text-neutral-500"}`}></i>
                                    {option}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Dropdown Custom Input Pinned to Bottom */}
                            <div className="mt-2 pt-2 border-t border-white/10 relative">
                              <input
                                type="text"
                                placeholder={`手动添加${category.label}...`}
                                value={customInputs[category.id] || ""}
                                onChange={(e) => setCustomInputs((prev) => ({ ...prev, [category.id]: e.target.value }))}
                                onKeyDown={(e) => handleKeyDown(e, category.id)}
                                className="w-full bg-black/20 border border-white/10 focus:border-red-500/50 rounded-md pl-3 pr-8 py-2 text-sm text-white placeholder:text-neutral-600 outline-none transition-all"
                              />
                              <button
                                onClick={() => addCustomInput(category.id)}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                                  customInputs[category.id]?.trim() ? "text-red-500 hover:bg-red-500/20" : "text-neutral-600 pointer-events-none"
                                }`}
                              >
                                <i className="fas fa-plus"></i>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          )}
        </div>

        {/* BOTTOM CONTENT: Results Grid */}
        <main className="w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              {query ? `"${query}" 的搜索结果` : "全部作品"}
            </h2>
            <span className="text-sm text-neutral-500">找到 42 部作品</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="aspect-2/3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-neutral-600 animate-pulse hover:bg-white/10 transition-colors cursor-pointer">
                海报占位
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}