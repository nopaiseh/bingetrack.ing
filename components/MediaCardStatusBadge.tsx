import type { ReactElement } from "react";

interface StatusBadgeConfig {
  label: string;
  dotClass: string;
  pulse?: boolean;
  borderClass: string;
  textClass: string;
}

/** 解析观看状态值，返回对应的红绿灯视觉样式配置；未记录状态返回 null。 */
export function getStatusBadgeConfig(status: string | null | undefined): StatusBadgeConfig | null {
  if (!status) return null;
  const normalized = status.trim().toLowerCase();

  if (normalized === "watched" || normalized === "已看" || normalized === "已观看") {
    return {
      label: "已看",
      dotClass: "bg-[var(--ok)]",
      borderClass: "border-[color-mix(in_srgb,var(--ok)_45%,var(--border))]",
      textClass: "text-[var(--ok)]",
    };
  }

  if (normalized === "watching" || normalized === "在看" || normalized === "正在看") {
    return {
      label: "在看",
      dotClass: "bg-[var(--warn)]",
      pulse: true,
      borderClass: "border-[color-mix(in_srgb,var(--warn)_45%,var(--border))]",
      textClass: "text-[var(--warn)]",
    };
  }

  if (normalized === "want_to_watch" || normalized === "想看" || normalized === "想要看") {
    return {
      label: "想看",
      dotClass: "bg-[var(--accent)]",
      borderClass: "border-[var(--accent-border)]",
      textClass: "text-[var(--accent-hover)]",
    };
  }

  return null;
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

