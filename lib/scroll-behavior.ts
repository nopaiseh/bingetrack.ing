/** 系统要求减少动态效果时，程序化滚动用瞬间跳转，否则平滑滚动。 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window.matchMedia !== "function") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
