/** 判断当前是否处于 `next build` 预渲染阶段。 */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * 页面数据加载失败时的统一处理：构建期记录后降级为空数据，避免数据库不可用阻断构建；
 * 运行期重新抛出，让 ISR 继续提供上一次成功生成的页面，并由 Sentry 的 onRequestError 上报。
 */
export function handlePageDataError(page: string, error: unknown): void {
  if (!isBuildPhase()) throw error;
  console.error(`Failed to fetch ${page} data during build, falling back to empty content:`, error);
}
