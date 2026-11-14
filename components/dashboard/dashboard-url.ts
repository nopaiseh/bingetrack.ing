export const TABS = ["总览", "电影", "电视节目"];
export const TAB_IDS: Record<string, string> = { 总览: "overview", 电影: "movies", 电视节目: "tv-shows" };

// 看板视图与年份写入查询串（?view=movies&year=2023），跳转搜索页后返回、刷新或分享链接时都能还原。
// 首页为静态预渲染，useSearchParams 会让整个看板退化为仅客户端渲染，因此直接订阅 location.search：
// 服务端与水合阶段读取空查询串，保持预渲染 HTML 不变，水合后再切换到链接指定的视图。
const urlListeners = new Set<() => void>();

/** 订阅查询串变化：本组件写入 URL 时手动通知，浏览器前进后退时由 popstate 通知。 */
export function subscribeToUrl(listener: () => void) {
  urlListeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    urlListeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

/** 读取当前查询串作为客户端快照。 */
export const getUrlSnapshot = () => window.location.search;
/** 预渲染与水合时视为无查询串，与静态 HTML 保持一致。 */
export const getServerUrlSnapshot = () => "";

/** 用 replaceState 更新看板参数，不新增历史记录；默认值从查询串中省略。 */
export function writeDashboardParams(view: string, year: string) {
  const params = new URLSearchParams(window.location.search);
  if (view === TAB_IDS["总览"]) params.delete("view"); else params.set("view", view);
  if (year === "All Time") params.delete("year"); else params.set("year", year);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  urlListeners.forEach((listener) => listener());
}
