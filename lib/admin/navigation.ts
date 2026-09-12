/** 只恢复管理列表地址，拒绝存储中被修改的外部地址或详情地址。 */
export function rememberedList(category: string, fallback: string): string {
  try {
    const stored = sessionStorage.getItem(`manage:list:${category}`);
    if (!stored) return fallback;
    const url = new URL(stored, window.location.origin);
    if (url.origin !== window.location.origin || (url.pathname !== "/manage" && url.pathname !== `/manage/references/${category}`)) return fallback;
    return `${url.pathname}${url.search}`;
  } catch { return fallback; }
}
/** 下拉分类和弹窗关闭没有原生链接，复用未保存检查事件。 */
export function mayLeaveEditor() {
  return document.dispatchEvent(new Event("manage:before-leave", { cancelable: true }));
}
