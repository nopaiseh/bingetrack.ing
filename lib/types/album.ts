import type { OwnershipStatus } from "@/lib/album-display";
import type { Media, MediaCard } from "@/lib/types";

export type AlbumTrack = {
  id: string;
  trackNumber: number | null;
  title: string;
  singers: string[];
  lyricists: string[];
  composers: string[];
  /** 曲目自身类型名（media_genres）；最多 2 个，与专辑类型无关。 */
  genres: string[];
  /** media_items.runtime，按秒展示为 m:ss；空则无时长。 */
  durationSeconds: number | null;
  status: string | null;
  rating: number | null;
};

/** 专辑所属的一个作品系列：名称、当前专辑序位、同系列其他条目。 */
export type AlbumSeriesMembership = {
  name: string;
  /** 当前专辑在该系列中的序位（第几部）；无则为 null。 */
  position: number | null;
  /**
   * 同系列其他条目（不含当前），按 seriesPosition、发行日排序。
   * 每张卡片含 seriesPosition，供前端渲染「第几部」。
   */
  items: MediaCard[];
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
  /** 所属系列；无系列时为空数组。media.series 同步为系列名称列表。 */
  series: AlbumSeriesMembership[];
};
