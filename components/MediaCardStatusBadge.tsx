import type { ReactElement } from "react";
import { resolveWatchStatus } from "@/components/watch-status";

interface StatusBadgeConfig {
  label: string;
  dotClass: string;
  pulse?: boolean;
  borderClass: string;
  textClass: string;
}

/** 解析观看状态值，返回与全站一致的红绿灯样式；未记录状态返回 null。 */
export function getStatusBadgeConfig(status: string | null | undefined): StatusBadgeConfig | null {
  const config = resolveWatchStatus(status);
  if (!config) return null;
  return {
    label: config.label,
    dotClass: config.dotClass,
    ...(config.pulse ? { pulse: true } : {}),
    borderClass: config.borderClass,
    textClass: config.textClass,
  };
}

/** 渲染卡片右上角的红绿灯观看状态微光徽标（已看=绿，在看=黄，想看=红）。 */
export default function MediaCardStatusBadge({
  status,
  className = "",
  placement = "overlay",
}: {
  status?: string | null;
  className?: string;
  /** overlay 盖在海报角上；inline 跟在年份后面，给搜索海报网格用。 */
  placement?: "overlay" | "inline";
}): ReactElement | null {
  const config = getStatusBadgeConfig(status);
  if (!config) return null;

  return (
    <div
      data-testid="media-card-status-badge"
      className={`pointer-events-none inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${
        placement === "overlay" ? "absolute top-2 right-2 z-10 bg-[var(--canvas)] transition-opacity duration-300" : "bg-transparent"
      } ${config.borderClass} ${config.textClass} ${className}`}
      aria-label={`观看状态：${config.label}`}
      title={config.label}
    >
      {config.pulse ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--warn)] opacity-75 duration-1000" />
          <span className={`relative inline-flex size-1.5 rounded-full ${config.dotClass}`} />
        </span>
      ) : (
        <span className={`inline-block size-1.5 rounded-full ${config.dotClass}`} />
      )}
      <span>{config.label}</span>
    </div>
  );
}

