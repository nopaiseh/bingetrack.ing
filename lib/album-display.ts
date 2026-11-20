/** 拥有权：与收听追踪独立；公开可读。 */
export type OwnershipStatus = "want_to_own" | "owned";

/** 曲目时长：runtime 按秒格式化为 m:ss；不足一秒或非法返回 null。 */
export function formatTrackDuration(runtimeSeconds: number | null | undefined): string | null {
  if (runtimeSeconds == null || !Number.isFinite(runtimeSeconds) || runtimeSeconds < 1) return null;
  const total = Math.round(runtimeSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** 拥有权中文标签。 */
export function ownershipLabel(status: OwnershipStatus | null | undefined): string | null {
  if (status === "owned") return "已拥有";
  if (status === "want_to_own") return "想拥有";
  return null;
}
