// 公开缓存的全站标签：引用资料改名、批量清理等影响面难以界定的写入用它整体失效。
export const MEDIA_TAG = "media";

// 首页榜单、统计与搜索等聚合数据的标签，任何条目变更都可能影响它们。
export const MEDIA_LISTS_TAG = "media:lists";

/** 单个条目详情与季摘要的标签；详情页渲染时继承该标签，保存条目时只失效受影响的详情页。 */
export function mediaItemTag(id: string): string {
  return `media:item:${id}`;
}
