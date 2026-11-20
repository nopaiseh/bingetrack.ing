import { MEDIA_TYPE_DEFINITIONS } from "@/lib/media-types";

const LABELS = MEDIA_TYPE_DEFINITIONS.book.trackingLabels;

/** 图书阅读状态展示文案（tracking 存 want_to_watch／in_progress／watched）。 */
export function readStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case "watched":
      return LABELS.done;
    case "want_to_watch":
      return LABELS.want;
    case "in_progress":
      return LABELS.inProgress ?? null;
    default:
      return null;
  }
}

/** 图书可写入的 tracking 状态（含在读）。 */
export const BOOK_TRACKING_STATUSES = ["want_to_watch", "in_progress", "watched"] as const;
export type BookTrackingStatus = (typeof BOOK_TRACKING_STATUSES)[number];

export function isBookTrackingStatus(value: string | null | undefined): value is BookTrackingStatus {
  return value === "want_to_watch" || value === "in_progress" || value === "watched";
}
