export interface RuntimeParts {
  days: number;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

/** 将分钟数拆解为天、小时、分钟及总分钟数，非正数或非法数值均归零。 */
export function parseRuntimeParts(runtime: number | null | undefined): RuntimeParts {
  if (runtime == null || !Number.isFinite(runtime) || runtime <= 0) {
    return { days: 0, hours: 0, minutes: 0, totalMinutes: 0 };
  }

  const totalMinutes = Math.round(runtime);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return { days, hours, minutes, totalMinutes };
}

/** 将分钟数四舍五入到整分钟，按天、小时、分钟展示并省略零值单位；支持零值兜底展示。 */
export function formatRuntime(runtime: number | null | undefined, fallbackZero = false): string | null {
  if (runtime == null || !Number.isFinite(runtime) || runtime <= 0) {
    return fallbackZero ? "0 分钟" : null;
  }

  const { days, hours, minutes } = parseRuntimeParts(runtime);

  return [
    days > 0 ? `${days} 天` : null,
    hours > 0 ? `${hours} 小时` : null,
    minutes > 0 ? `${minutes} 分钟` : null,
  ].filter(Boolean).join(" ") || (fallbackZero ? "0 分钟" : null);
}

