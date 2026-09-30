import { mediaTypes } from "./media-form";

/** 职务显示顺序：同一作品兼任多职时按此顺序合并，如「导演、演员」。 */
const creditRoles = { director: "导演", actor: "演员", author: "作者", artist: "艺术家", composer: "作曲" } as const;

/** 关联作品列表展示所需的媒体字段；季与单集附带所属节目，便于区分同名条目。 */
export type RelatedMedia = {
  id: string;
  title: string;
  alternate_title?: string | null;
  type: string;
  release_date?: string | null;
  runtime?: number | string | null;
  cover_url?: string | null;
  tv_seasons?: { season_number: number; parent?: { title: string } | null } | null;
  tv_episodes?: { episode_number: number; parent?: { season_number: number; series?: { title: string } | null } | null } | null;
};
/** 人物关联带职务与角色名；类型、地区、语言的关联没有 role。 */
export type CreditRow = { media_item_id: string; role?: string; character_name?: string | null; media_items: RelatedMedia | null };
type CreditWork = { media: RelatedMedia; roles: string[]; characters: string[] };
type CreditGroup = { type: string; label: string; works: CreditWork[] };

/** 关联作品卡片需要的 media_items 列，含季与单集所属节目。 */
export const relatedMediaColumns = "id,title,alternate_title,type,release_date,runtime,cover_url,tv_seasons!tv_seasons_id_fkey(season_number,parent:media_items!tv_seasons_series_id_fkey(title)),tv_episodes!tv_episodes_id_fkey(episode_number,parent:tv_seasons!tv_episodes_season_id_fkey(season_number,series:media_items!tv_seasons_series_id_fkey(title)))";
/** 从关联表嵌套读取完整卡片字段。 */
export const relatedMediaFields = `media_items(${relatedMediaColumns})`;
/** 分组与排序只需要的轻量字段，先读全部关联再分页取卡片详情。 */
export const relatedMediaSortFields = "media_items(id,title,type,release_date)";

const typeOrder: string[] = Object.keys(mediaTypes);
const roleOrder: string[] = Object.keys(creditRoles);

/** 未知职务原样显示，保证新增枚举值不会被吞掉。 */
export function roleLabel(role: string) {
  return (creditRoles as Record<string, string>)[role] ?? role;
}

/** 每部作品只出现一次并合并职务与角色名，再按媒体类型分组；组内按上映日期倒序，无日期排最后。
 * 分组结果按顺序展开即为分页顺序，同一类型的作品在页间连续。 */
export function groupCredits(rows: CreditRow[]): CreditGroup[] {
  const works = new Map<string, CreditWork>();
  for (const row of rows) {
    if (!row.media_items) continue;
    const work = works.get(row.media_item_id) ?? { media: row.media_items, roles: [], characters: [] };
    if (row.role && !work.roles.includes(row.role)) work.roles.push(row.role);
    if (row.character_name && !work.characters.includes(row.character_name)) work.characters.push(row.character_name);
    works.set(row.media_item_id, work);
  }
  const rank = (order: string[], value: string) => { const index = order.indexOf(value); return index < 0 ? order.length : index; };
  const groups = new Map<string, CreditWork[]>();
  for (const work of works.values()) {
    work.roles.sort((a, b) => rank(roleOrder, a) - rank(roleOrder, b) || a.localeCompare(b));
    const list = groups.get(work.media.type);
    if (list) list.push(work); else groups.set(work.media.type, [work]);
  }
  return [...groups].sort(([a], [b]) => rank(typeOrder, a) - rank(typeOrder, b) || a.localeCompare(b)).map(([type, list]) => ({
    type,
    label: (mediaTypes as Record<string, string>)[type] ?? type,
    works: list.sort((a, b) => (b.media.release_date ?? "").localeCompare(a.media.release_date ?? "") || a.media.title.localeCompare(b.media.title, "zh-CN") || a.media.id.localeCompare(b.media.id)),
  }));
}
