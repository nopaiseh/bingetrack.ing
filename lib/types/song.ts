/**
 * `get_song_detail` 返回形状（PR #296）。
 * 本前端 PR 不依赖未合并的 generated Database 类型；在此手写最小契约。
 */

/** 相关歌曲上的共享角色；后端固定顺序 artist → composer → lyricist。 */
export type SongRelationRole = "artist" | "composer" | "lyricist";

/** 歌曲演职角色（credits 对象的键）。 */
export type SongCreditRole = "artist" | "composer" | "lyricist" | "arranger" | "producer" | "featured";

export type SongCreditPerson = {
  id: string;
  name: string;
  alternate_name: string | null;
};

export type SongAlbumOtherTrack = {
  id: string;
  title: string;
  disc_number: number | null;
  track_number: number | null;
  duration_seconds: number | null;
};

export type SongAlbumMembership = {
  id: string;
  title: string;
  cover_url: string | null;
  release_date: string | null;
  release_kind: string | null;
  disc_number: number | null;
  track_number: number | null;
  other_tracks: SongAlbumOtherTrack[];
};

export type RelatedSong = {
  id: string;
  title: string;
  cover_url: string | null;
  release_date: string | null;
  /** 子集于 artist／composer／lyricist；已去重且固定顺序。 */
  relations: SongRelationRole[];
};

export type SongSeriesRef = {
  id: string;
  name: string;
};

export type SongTracking = {
  status: string | null;
  rating: number | null;
} | null;

/** 公开歌曲详情页使用的完整载荷。 */
export type SongDetail = {
  id: string;
  title: string;
  alternate_title: string | null;
  duration_seconds: number | null;
  release_date: string | null;
  summary: string | null;
  cover_url: string | null;
  genres: string[];
  languages: string[];
  series: SongSeriesRef[];
  /** 按角色聚合；缺角角色的键可省略。 */
  credits: Partial<Record<SongCreditRole, SongCreditPerson[]>>;
  albums: SongAlbumMembership[];
  related: RelatedSong[];
  tracking: SongTracking;
};
