import { BOOK_TRACKING_STATUSES, type BookTrackingStatus, readStatusLabel } from "@/lib/read-status";
import { WATCH_STATUSES } from "@/components/watch-status";

const ORDER: readonly BookTrackingStatus[] = BOOK_TRACKING_STATUSES;

function statusTone(status: BookTrackingStatus) {
  if (status === "watched") return WATCH_STATUSES.watched;
  if (status === "in_progress") return WATCH_STATUSES.in_progress;
  return WATCH_STATUSES.want_to_watch;
}

/**
 * 图书详情的三态阅读状态分段（想读／在读／读过）。
 * 公开页只展示当前状态，不可点击改写。
 */
export default function ReadStatusSegment({
  status,
  className = "",
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const current: BookTrackingStatus =
    status === "watched" || status === "in_progress" || status === "want_to_watch" ? status : "want_to_watch";

  return (
    <div
      className={`inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-panel)] p-1 ${className}`}
      role="group"
      aria-label="阅读状态"
    >
      {ORDER.map((value) => {
        const active = value === current;
        const tone = statusTone(value);
        const label = readStatusLabel(value) ?? value;
        return (
          <span
            key={value}
            role="status"
            aria-current={active ? "true" : undefined}
            className={`inline-flex min-h-10 min-w-[4.5rem] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors ${
              active
                ? `${tone.surfaceClass} ${tone.textClass} border ${tone.borderClass}`
                : "border border-transparent text-fg-muted"
            }`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
