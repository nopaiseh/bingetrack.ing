import { isMediaId } from "@/lib/functions/media-id";
import { mediaTypes, type ManagedMediaType } from "@/lib/media-types";

export { mediaTypes, type ManagedMediaType };

/**
 * 决定写入媒体条目的封面。
 * 季忽略提交值，新建和更新都存 null，不会改成新的地址。电影、电视节目和单集保留提交的封面。
 */
export function coverUrlForSave(type: ManagedMediaType, supplied: string | null): string | null {
  return type === "tv_season" ? null : supplied;
}

/** 演员／导演人数上限（credits）。 */
export const MAX_CREDITS = 300;
/** 演员／导演整段原始文本字符上限。 */
export const MAX_CREDITS_RAW = 150000;
/** 类型、语言、地区、系列等名称列表条目上限（names）。 */
export const MAX_NAMES = 100;
/** 名称列表整段原始文本字符上限。 */
export const MAX_NAMES_RAW = 10000;
/** 单条姓名、角色或关联名称的字符上限。 */
export const MAX_CREDIT_FIELD = 200;

/** 关联人物；id 为 null 表示按名称匹配或新建无别名人物，同名人物只能凭 id 区分。 */
export type PersonRef = { id: string | null; name: string; alternate_name?: string | null };
/** 演员及其饰演的角色；未填写角色时为 null。 */
export type ActorCredit = PersonRef & { character: string | null };
export type MediaInput = {
  id: string | null;
  type: ManagedMediaType;
  title: string;
  alternate_title: string | null;
  summary: string | null;
  cover_url: string | null;
  release_date: string | null;
  runtime: number | null;
  parent_id: string | null;
  number: number | null;
  status: "watched" | "watching" | "want_to_watch";
  rating: number | null;
  genres: string[];
  languages: string[];
  regions: string[];
  actors: ActorCredit[];
  directors: PersonRef[];
  collections?: string[];
};

const nameFieldLabels: Record<string, string> = {
  genres: "类型",
  languages: "语言",
  regions: "地区",
  collections: "系列",
};

/** 严格检查服务端表单，公开查询的筛选语义不受影响。 */
export function parseMediaForm(form: FormData): MediaInput {
  /** 只接受字符串，限制长度，并把空白值规范化为 null。 */
  function string(key: string, max = 300): string | null {
    const raw = form.get(key);
    if (raw !== null && typeof raw !== "string") throw new Error("表单字段格式不正确。");
    const value = raw?.trim() || null;
    if (value && value.length > max) throw new Error(`${key} 内容过长。`);
    return value;
  }
  /** 校验有限数值及可选整数约束，避免 NaN、负数和隐式空值转换。 */
  function numeric(key: string, max: number, integer = false) {
    const raw = string(key);
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value)))
      throw new Error("时长、评分或编号超出有效范围。");
    return value;
  }
  /** 一行一个名称，保留名字里的逗号，并去除重复条目。 */
  function names(key: string) {
    const label = nameFieldLabels[key] ?? key;
    const raw = form.get(key);
    if (raw !== null && typeof raw !== "string") throw new Error("表单字段格式不正确。");
    const text = raw?.trim() ?? "";
    if (text.length > MAX_NAMES_RAW) throw new Error(`${label}文本过长（最多 ${MAX_NAMES_RAW} 字符）。`);
    const seen = new Set<string>();
    const values: string[] = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      const value = line.trim();
      if (!value) continue;
      if (value.length > MAX_CREDIT_FIELD) throw new Error(`${label}第 ${index + 1} 行超过 ${MAX_CREDIT_FIELD} 字。`);
      if (seen.has(value)) continue;
      seen.add(value);
      values.push(value);
    }
    if (values.length > MAX_NAMES) throw new Error(`${label}最多 ${MAX_NAMES} 个，当前 ${values.length} 个。`);
    return values;
  }
  /** 每行「人物 ID<Tab>姓名<Tab>角色」，ID 与角色可留空，无制表符的行视为仅有姓名；同一人物只保留第一行，无 ID 时按姓名去重。 */
  function credits(key: string): ActorCredit[] {
    // 不整体 trim，首行空 ID 的前导制表符是格式的一部分。
    const raw = form.get(key) ?? "";
    const label = key === "directors" ? "导演" : "演员";
    if (typeof raw !== "string" || raw.length > MAX_CREDITS_RAW)
      throw new Error(`${label}表文本过长（最多 ${MAX_CREDITS_RAW} 字符）。`);
    const seen = new Set<string>();
    const values: ActorCredit[] = [];
    for (const [index, line] of raw.split(/\r?\n/).entries()) {
      const [rawId, rawName = "", ...rest] = line.includes("\t") ? line.split("\t") : ["", line];
      const id = rawId.trim() || null;
      const name = rawName.trim();
      if (id && !isMediaId(id)) throw new Error("人物 ID 格式不正确。");
      const identity = id ?? `name:${name}`;
      if (!name || seen.has(identity)) continue;
      if (name.length > MAX_CREDIT_FIELD)
        throw new Error(`${label}表第 ${index + 1} 行姓名超过 ${MAX_CREDIT_FIELD} 字。`);
      const character = rest.join(" ").trim() || null;
      if (character && character.length > MAX_CREDIT_FIELD)
        throw new Error(`${label}表第 ${index + 1} 行角色超过 ${MAX_CREDIT_FIELD} 字。`);
      seen.add(identity);
      values.push({ id, name, character });
    }
    if (values.length > MAX_CREDITS) throw new Error(`${label}最多 ${MAX_CREDITS} 人，当前 ${values.length} 人。`);
    return values;
  }
  const id = string("id");
  const type = string("type");
  const title = string("title");
  const parent_id = string("parent_id");
  if ((id && !isMediaId(id)) || (parent_id && !isMediaId(parent_id))) throw new Error("媒体 ID 格式不正确。");
  if (!type || !Object.hasOwn(mediaTypes, type)) throw new Error("不支持的媒体类型。");
  if (!title) throw new Error("请填写标题。");
  const number = numeric("number", 100000, true);
  if ((type === "tv_season" || type === "tv_episode") && (!parent_id || number === null))
    throw new Error("请指定上级条目和季／集编号。");
  if (id && id === parent_id) throw new Error("不能把条目设为自己的上级。");
  // 季不设海报。不读取、不校验提交的 cover_url，新建和更新都写入 null，不采用新的封面地址。
  // 这里不改已有行；只有之后再次保存该季时，数据库才会按这份 payload 把封面写成 null。
  const cover_url = coverUrlForSave(type as ManagedMediaType, type === "tv_season" ? null : string("cover_url", 2000));
  if (cover_url) {
    let url: URL;
    try {
      url = new URL(cover_url);
    } catch {
      throw new Error("封面地址必须是有效的 TMDB HTTPS 地址。");
    }
    // 与 CSP 的 img-src 和 lib/tmdb-image.ts 的尺寸换算一致，其他地址浏览器不会加载。
    if (
      url.protocol !== "https:" ||
      url.hostname !== "image.tmdb.org" ||
      !url.pathname.startsWith("/t/p/") ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("封面请使用 TMDB HTTPS 图片地址。");
  }
  const isDerived = type === "tv_show" || type === "tv_season";
  const release_date = isDerived ? null : string("release_date");
  if (
    release_date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(release_date) ||
      !Number.isFinite(Date.parse(release_date)) ||
      new Date(release_date).toISOString().slice(0, 10) !== release_date)
  )
    throw new Error("发行日期无效。");
  const rating = isDerived ? null : numeric("rating", 10);
  if (rating !== null && Math.abs(rating * 10 - Math.round(rating * 10)) > 1e-8)
    throw new Error("评分最多保留一位小数。");
  // 有评分即看过、没有评分即没看过，不再单独选择观看状态；忽略提交的 status，旧页面也不会写出不一致的记录。
  // 电视节目与季没有评分，状态恒为 want_to_watch，仅用于通过 RPC 校验，数据库不会为它们保存 tracking。
  const effectiveStatus: "watched" | "want_to_watch" = rating !== null ? "watched" : "want_to_watch";
  const isChild = type === "tv_season" || type === "tv_episode";
  return {
    id,
    type: type as ManagedMediaType,
    title,
    alternate_title: string("alternate_title"),
    summary: string("summary", 20000),
    cover_url,
    release_date,
    runtime: isDerived ? null : numeric("runtime", 100000),
    parent_id,
    number,
    status: effectiveStatus,
    rating,
    genres: isChild ? [] : names("genres"),
    languages: isChild ? [] : names("languages"),
    regions: isChild ? [] : names("regions"),
    actors: isChild ? [] : credits("actors"),
    directors: isChild ? [] : credits("directors").map(({ id, name }) => ({ id, name })),
    collections: isChild ? [] : names("collections"),
  };
}
