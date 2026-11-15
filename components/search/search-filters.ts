import type { SearchFilters } from "@/lib/api/search-state";

/** 根据点击项更新单选或多选筛选；全部选中时用空数组表示不限制。 */
export function toggleSearchFilter(
  prev: SearchFilters,
  categoryId: string,
  value: string,
  isMultiSelect = true,
  allOptions: string[] = [],
): SearchFilters {
  const currentSelected = prev[categoryId] || [];
  if (value === "全部") return { ...prev, [categoryId]: [] };
  if (!isMultiSelect) return { ...prev, [categoryId]: [value] };
  if (currentSelected.includes(value)) {
    return {
      ...prev,
      [categoryId]: currentSelected.filter(/* 从已选列表中移除再次点击的选项。 */ (item) => item !== value),
    };
  }
  const newSelected = [...currentSelected, value];
  const hasSelectedAll =
    allOptions.length > 0 &&
    allOptions.every(/* 判断该分类的所有可选值是否均已选中。 */ (opt) => newSelected.includes(opt));
  return { ...prev, [categoryId]: hasSelectedAll ? [] : newSelected };
}

/** 同一排序字段再次点击时反转方向，切换字段时默认降序。 */
export function toggleSearchSort(prev: SearchFilters, fieldId: string): SearchFilters {
  const currentSort = prev.sort[0] || "date_desc";
  const [currentField, currentOrder] = currentSort.split("_");
  if (currentField === fieldId) {
    const newOrder = currentOrder === "desc" ? "asc" : "desc";
    return { ...prev, sort: [`${fieldId}_${newOrder}`] };
  }
  return { ...prev, sort: [`${fieldId}_desc`] };
}

/** 更新起始或结束年份；出现倒置范围时将另一端同步到新值。 */
export function changeSearchYear(prev: SearchFilters, type: "start" | "end", value: string): SearchFilters {
  const currentStart = prev.year?.[0] || "";
  const currentEnd = prev.year?.[1] || "";
  let newStart = type === "start" ? value : currentStart;
  let newEnd = type === "end" ? value : currentEnd;

  if (newStart && newEnd && parseInt(newStart) > parseInt(newEnd)) {
    if (type === "start") newEnd = newStart;
    else newStart = newEnd;
  }
  return { ...prev, year: [newStart, newEnd] };
}
