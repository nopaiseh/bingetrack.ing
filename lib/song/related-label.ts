import type { SongRelationRole } from "@/lib/types/song";

/** 相关歌曲 relations → 中文标签；不用代词。 */
export const SONG_RELATION_LABELS: Record<SongRelationRole, string> = {
  artist: "演唱",
  composer: "作曲",
  lyricist: "作词",
};

/** 固定展示顺序，与后端 relations 数组一致。 */
export const SONG_RELATION_ORDER: readonly SongRelationRole[] = ["artist", "composer", "lyricist"];

/**
 * 将 related.relations 建成「演唱・作词」类标签。
 * 未知角色忽略；空数组返回空串。
 */
export function buildRelatedSongRelationLabel(relations: readonly string[] | null | undefined): string {
  if (!relations || relations.length === 0) return "";
  const seen = new Set<string>();
  const ordered: SongRelationRole[] = [];
  for (const role of SONG_RELATION_ORDER) {
    if (relations.includes(role) && !seen.has(role)) {
      seen.add(role);
      ordered.push(role);
    }
  }
  return ordered.map((role) => SONG_RELATION_LABELS[role]).join("・");
}
