import type { ReactNode } from "react";

export type WatchStatusId = "watched" | "watching" | "want_to_watch";

export interface WatchStatus {
  id: WatchStatusId;
  label: "已看" | "在看" | "想看";
  dotClass: string;
  borderClass: string;
  textClass: string;
  surfaceClass: string;
  pulse?: boolean;
  icon: string;
}

/** 公开页面共用的观看状态：文案和颜色只在这里定义。 */
export const WATCH_STATUSES: Record<WatchStatusId, WatchStatus> = {
  watched: {
    id: "watched",
    label: "已看",
    dotClass: "bg-[var(--ok)]",
    borderClass: "border-[color-mix(in_srgb,var(--ok)_45%,var(--border))]",
    textClass: "text-[var(--ok)]",
    surfaceClass: "bg-[var(--ok-soft)]",
    icon: "i-material-symbols-check-circle-rounded",
  },
  watching: {
    id: "watching",
    label: "在看",
    dotClass: "bg-[var(--warn)]",
    borderClass: "border-[color-mix(in_srgb,var(--warn)_45%,var(--border))]",
    textClass: "text-[var(--warn)]",
    surfaceClass: "bg-[var(--warn-soft)]",
    pulse: true,
    icon: "i-material-symbols-play-circle-outline-rounded",
  },
  want_to_watch: {
    id: "want_to_watch",
    label: "想看",
    dotClass: "bg-[var(--accent)]",
    borderClass: "border-[var(--accent-border)]",
    textClass: "text-[var(--accent-hover)]",
    surfaceClass: "bg-[var(--accent-soft)]",
    icon: "i-material-symbols-bookmark-outline-rounded",
  },
};

const ALIASES: Record<string, WatchStatusId> = {
  watched: "watched",
  "已看": "watched",
  "已观看": "watched",
  watching: "watching",
  "在看": "watching",
  "正在看": "watching",
  want_to_watch: "want_to_watch",
  "想看": "want_to_watch",
  "想要看": "want_to_watch",
};

/** 把状态值或旧文案解析成统一配置；未记录和未知值返回 null。 */
export function resolveWatchStatus(status: string | null | undefined): WatchStatus | null {
  if (!status) return null;
  const trimmed = status.trim();
  const id = ALIASES[trimmed] ?? ALIASES[trimmed.toLowerCase()];
  return id ? WATCH_STATUSES[id] : null;
}

function StatusMark({ status }: { status: WatchStatus }): ReactNode {
  if (status.pulse) {
    return (
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--warn)] opacity-75 duration-1000" />
        <span className={`relative inline-flex size-2 rounded-full ${status.dotClass}`} />
      </span>
    );
  }
  return <span className={`${status.icon} inline-block size-3.5`} aria-hidden="true" />;
}

/** 详情、季列表和单集行共用的状态胶囊。卡片角标仍用定位过的 MediaCardStatusBadge。 */
export function WatchStatusBadge({
  status,
  fallback = null,
  className = "",
}: {
  status?: string | null;
  fallback?: WatchStatusId | null;
  className?: string;
}) {
  const config = resolveWatchStatus(status) ?? (fallback ? WATCH_STATUSES[fallback] : null);
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${config.borderClass} ${config.surfaceClass} ${config.textClass} ${className}`}
      aria-label={`观看状态：${config.label}`}
    >
      <StatusMark status={config} />
      {config.label}
    </span>
  );
}
