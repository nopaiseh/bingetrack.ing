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
}: {
  status?: string | null;
  className?: string;
}): ReactElement | null {
  const config = getStatusBadgeConfig(status);
  if (!config) return null;

  return (
    <div
      data-testid="media-card-status-badge"
      className={`pointer-events-none absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-full border bg-[var(--canvas)] px-2 py-1 text-xs font-medium transition-opacity duration-300 ${config.borderClass} ${config.textClass} ${className}`}
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

