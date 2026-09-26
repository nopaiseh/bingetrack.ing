import type { CSSProperties } from "react";

const FADE = "2rem";

/** 为横向滚动列表生成左右边缘渐隐遮罩：只在还能继续滚动的一侧淡出，让内容融入背后的主题极光而不是盖上一层纯色暗影。 */
export function edgeFadeMask(canScrollLeft: boolean, canScrollRight: boolean): CSSProperties | undefined {
  if (!canScrollLeft && !canScrollRight) return undefined;
  const start = canScrollLeft ? `transparent 0, #000 ${FADE}` : "#000 0";
  const end = canScrollRight ? `#000 calc(100% - ${FADE}), transparent 100%` : "#000 100%";
  const mask = `linear-gradient(to right, ${start}, ${end})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}
