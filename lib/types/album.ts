import type { OwnershipStatus } from "@/lib/album-display";
import type { Media } from "@/lib/types";

export type AlbumTrack = {
  id: string;
  trackNumber: number | null;
  title: string;
  singers: string[];
  lyricists: string[];
  composers: string[];
  /** media_items.runtime，按秒展示为 m:ss；空则无时长。 */
  durationSeconds: number | null;
  status: string | null;
  rating: number | null;
};

export type AlbumDetail = {
  media: Media;
  artists: string[];
  trackCount: number | null;
  label: string | null;
  /** 已评分曲目数；平均分来自 v_all_media.rating。 */
  ratedCount: number;
  ownership: OwnershipStatus | null;
  tracks: AlbumTrack[];
};
