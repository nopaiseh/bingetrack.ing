import { MEDIA_TYPE_DEFINITIONS } from "@/lib/media-types";

const LABELS = MEDIA_TYPE_DEFINITIONS.music.trackingLabels;

/** 单曲／专辑收听状态的展示文案（tracking 仍存 watched／want_to_watch／watching）。 */
export function listenStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case "watched":
      return LABELS.done;
    case "want_to_watch":
      return LABELS.want;
    case "watching":
      return "在听";
    default:
      return null;
  }
}
