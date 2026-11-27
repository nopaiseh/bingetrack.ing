import type { SongCreditRole } from "@/lib/types/song";

/** 歌曲详情演职分区标题；artist 用「演唱」而非字典「艺人」。 */
export const SONG_CREDIT_SECTION_LABELS: Record<SongCreditRole, string> = {
  artist: "演唱",
  composer: "作曲",
  lyricist: "作词",
  arranger: "编曲",
  producer: "制作人",
  featured: "合唱",
};

/** 歌曲详情 credits 展示顺序（与 credit_roles.sort_order 一致）。 */
export const SONG_CREDIT_ROLE_ORDER: readonly SongCreditRole[] = [
  "artist",
  "composer",
  "lyricist",
  "arranger",
  "producer",
  "featured",
];
