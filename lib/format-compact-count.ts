/** 把非有限或负数计数收成非负整数；小数向下取整，避免夸大。 */
export function normalizeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/**
 * 中文紧凑计数：不足一千原样；千／万／亿各至多一位小数（向下截断，去掉末尾 .0）。
 * 例：1000→1千，1250→1.2千，12000→1.2万，1e8→1亿。
 */
export function formatCompactCount(value: number): string {
  const n = normalizeCount(value);
  if (n < 1_000) return String(n);
  if (n < 10_000) return formatScaled(n, 1_000, "千");
  if (n < 100_000_000) return formatScaled(n, 10_000, "万");
  return formatScaled(n, 100_000_000, "亿");
}

/** 按尺度截断到一位小数并去掉末尾 .0。 */
function formatScaled(n: number, scale: number, suffix: string): string {
  const truncated = Math.floor((n / scale) * 10) / 10;
  const body = Number.isInteger(truncated) ? String(truncated) : truncated.toFixed(1);
  return `${body}${suffix}`;
}
