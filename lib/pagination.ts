/** 生成最多五个连续页码，靠近首尾页时调整窗口以避免越界。 */
export function pageNumbers(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, /* 将窗口内的索引转换为实际页码。 */ (_, index) => start + index);
}

export type PaginationItem = number | "start-gap" | "end-gap";

/** 在五页窗口两侧补上首页与末页，中间断开处以省略标记表示，便于直接跳到任意一端。 */
export function paginationItems(current: number, total: number): PaginationItem[] {
  const window = pageNumbers(current, total);
  const first = window[0];
  const last = window[window.length - 1];
  return [
    ...(first > 1 ? [1] : []),
    ...(first > 2 ? ["start-gap" as const] : []),
    ...window,
    ...(last < total - 1 ? ["end-gap" as const] : []),
    ...(last < total ? [total] : []),
  ];
}
