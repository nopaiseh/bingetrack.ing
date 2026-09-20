import type { ReactElement } from "react";

export interface StatusBadgeConfig {
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
      dotClass: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
      borderClass: "border-emerald-500/30",
      textClass: "text-emerald-300",
    };
  }

  if (normalized === "watching" || normalized === "在看" || normalized === "正在看") {
    return {
      label: "在看",
      dotClass: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
      pulse: true,
      borderClass: "border-amber-400/30",
      textClass: "text-amber-300",
    };
  }

  if (normalized === "want_to_watch" || normalized === "想看" || normalized === "想要看") {
    return {
      label: "想看",
      dotClass: "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]",
      borderClass: "border-rose-400/30",
      textClass: "text-rose-300",
    };
  }

  return null;
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
      className={`pointer-events-none absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium backdrop-blur-md border shadow-xs transition-opacity duration-300 ${config.borderClass} ${config.textClass} ${className}`}
      aria-label={`观看状态：${config.label}`}
      title={config.label}
    >
      {config.pulse ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75 duration-1000" />
          <span className={`relative inline-flex size-1.5 rounded-full ${config.dotClass}`} />
        </span>
      ) : (
        <span className={`inline-block size-1.5 rounded-full ${config.dotClass}`} />
      )}
      <span>{config.label}</span>
    </div>
  );
}

