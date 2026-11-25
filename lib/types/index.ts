import type { PublicMediaType } from "@/lib/media-types";

export interface Media {
  id: string;
  title: string;
  alternate_title?: string | null;
  date: string;
  release_year?: string | number | null;
  runtime?: number | null;
  rating: number | null;
  genres: string[];
  languages: string[];
  regions?: string[];
  series?: string[];
  status?: string;
  summary?: string;
  cover_url: string;
  /**
   * 宽幅剧照。数据里还没有这一列，页面只在已有地址时铺进大标题页头；
   * 缺省时用标题决定的设计令牌渐变，不向接口或数据库加字段。
   */
  backdrop_url?: string | null;
  casts?: string[];
  // 与 casts 按位置对应的饰演角色，未填写时为 null。
  characters?: (string | null)[];
  directors?: string[];
  /** 专辑／单曲艺人（media_credits role=artist，按 credit_order）。 */
  artists?: string[];
  /** 图书作者（media_credits role=author，按 credit_order）。 */
  authors?: string[];
  type?: PublicMediaType;
}

// 服务端传给浏览器的卡片字段集合，不包含详情页专用数据；可按需携带精选摘要。
// type 在公开目录段之外还可为 "music"：单曲会出现在搜索结果里，但尚无公开详情页。
export type MediaCard = Omit<
  Pick<
    Media,
    "id" | "title" | "date" | "release_year" | "rating" | "genres" | "languages" | "cover_url" | "type" | "status"
  >,
  "type"
> & {
  type?: PublicMediaType | "music";
  summary?: string;
  artists?: string[];
  authors?: string[];
  /** 数据库 media_type；搜索类型标签优先用它，避免未启用路由被归一成影视段。 */
  dbType?: string;
  /**
   * 所属作品系列中的顺序（media_item_series.position）。
   * 列表／相关作品接口未带回该字段时保持缺省，卡片不显示「第 N 部」。
   */
  seriesPosition?: number | null;
};

// 首页倒计时展台的统一条目；以后新增音乐、书籍时只需扩展 kind 并补充对应查询。
export interface UpcomingRelease {
  id: string;
  kind: "movie" | "episode";
  // 同一作品的多个条目共用分组键，展台只保留其中最早的一条（如一部剧的下一集）。
  groupId: string;
  title: string;
  subtitle?: string;
  releaseDate: string;
  cover_url: string;
  href: string;
  genres: string[];
  languages: string[];
  summary?: string;
}

export interface SeasonInfo {
  id: string;
  seasonNumber: number;
  title: string;
  alternateTitle?: string | null;
  coverUrl: string;
  episodeCount: number;
  watchedEpisodeCount: number;
  releaseYearRange?: string;
  summary?: string;
}

export interface EpisodeInfo {
  id: string;
  episodeNumber: number;
  title: string;
  alternateTitle?: string | null;
  summary: string;
  releaseDate: string | null;
  runtime: number | null;
  status: string | null;
  rating: number | null;
}

export interface SeasonEpisodePage {
  season: SeasonInfo;
  episodes: EpisodeInfo[];
  total: number;
  watchedCount: number;
  totalRuntime: number;
  averageRating: number | null;
}

export interface Summary {
  release_year: number | string;

  total_runtime: number;
  total_watched_runtime: number;
  total_unwatched_runtime: number;

  total_movies: number;
  watched_movies: number;
  unwatched_movies: number;

  total_movies_runtime: number;
  movies_watched_runtime: number;
  movies_unwatched_runtime: number;

  movie_avg_rating: number;

  total_series: number;
  watched_series: number;
  watching_series: number;
  unwatched_series: number;

  total_series_runtime: number;
  series_watched_runtime: number;
  series_unwatched_runtime: number;

  series_avg_rating: number;

  total_seasons: number;
  watched_seasons: number;
  watching_seasons: number;
  unwatched_seasons: number;

  total_series_episodes: number;
  watched_series_episodes: number;
  unwatched_episodes: number;

  total_albums: number;
  listened_albums: number;
  total_books: number;
  read_books: number;
  reading_books: number;
  want_albums: number;
  want_books: number;

  total_tracks: number;
  listened_tracks: number;
  want_tracks: number;

  album_avg_rating: number;
  book_avg_rating: number;
}

interface Stats {
  total?: number;
  watched?: number;
  watching?: number;
  want?: number;
  upcoming?: number;
}

export interface MediaCatalogProps {
  watched?: MediaCard[];
  watching?: MediaCard[];
  want?: MediaCard[];
  stats?: Stats;
}

export interface DistributionItem {
  name: string;
  percent: number;
  count: number;
}

export interface MediaDistribution {
  regions: DistributionItem[];
  languages: DistributionItem[];
  genres: DistributionItem[];
}

export type MediaDistributions = Record<PublicMediaType, Record<string, MediaDistribution>>;

export interface ViewAllMediaRow {
  id: string | number;
  title?: string | null;
  alternate_title?: string | null;
  sort_date?: string | null;
  first_air_date?: string | null;
  last_air_date?: string | null;
  release_date?: string | null;
  release_year?: string | number | null;
  runtime?: number | null;
  rating?: number | null;
  average_rating?: number | null;
  genres?: string[] | null;
  languages?: string[] | null;
  regions?: string[] | null;
  status?: string | null;
  summary?: string | null;
  cover_url?: string | null;
  casts?: string[] | null;
  characters?: (string | null)[] | null;
  directors?: string[] | null;
  artists?: string[] | null;
  authors?: string[] | null;
  type?: string | null;
  series?: string[] | null;
}

export interface FetchMediaListOptions {
  type?: string | null;
  seriesOnly?: boolean;
  creditRole?: string | null;
  status?: string | null;
  // 只保留仍有未上映内容的条目；与 status 同选时按“任一满足”合并。
  upcoming?: boolean;
  genre?: string | null;
  region?: string | null;
  language?: string | null;
  startYear?: string | null;
  endYear?: string | null;
  q?: string | null;
  sort?: string | null;
  limit?: number;
  offset?: number;
}
