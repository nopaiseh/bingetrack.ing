import { isAllowedBookCoverHost, normalizeIsbn } from "@/lib/books/resolve-cover";
import { isMediaId } from "@/lib/functions/media-id";
import { mediaTypes, type ManagedMediaType } from "@/lib/media-types";

export { mediaTypes, type ManagedMediaType };

/** 管理端可接受的封面主机（与 CSP img-src 对齐）。 */
const COVER_HOSTS = new Set(["image.tmdb.org", "coverartarchive.org", "archive.org"]);

function isAllowedCoverHost(hostname: string) {
  if (COVER_HOSTS.has(hostname)) return true;
  if (isAllowedBookCoverHost(hostname)) return true;
  // iTunes／Apple 封面：*.mzstatic.com；archive.org 镜像：*.archive.org
  return hostname.endsWith(".mzstatic.com") || hostname.endsWith(".archive.org");
}

/**
 * 决定写入媒体条目的封面。
 * 曲目／季／单集忽略提交值，新建和更新都存 null（展示分别用专辑／剧集封面）。
 * 其余类型保留提交的封面。
 */
export function coverUrlForSave(type: ManagedMediaType, supplied: string | null): string | null {
  return type === "tv_season" || type === "tv_episode" || type === "music" ? null : supplied;
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
  status: "watched" | "watching" | "want_to_watch" | "in_progress";
  rating: number | null;
  genres: string[];
  languages: string[];
  regions: string[];
  actors: ActorCredit[];
  directors: PersonRef[];
  /** 专辑／曲目艺人（media_credits.role=artist）。 */
  artists: PersonRef[];
  /** 曲目作词（media_credits.role=lyricist）。 */
  lyricists: PersonRef[];
  /** 曲目作曲（media_credits.role=composer）。 */
  composers: PersonRef[];
  /** 图书作者（media_credits.role=author）。 */
  authors: PersonRef[];
  /** 唱片公司；仅专辑写入 music_albums.label。 */
  label: string | null;
  /** 页数；仅图书写入 books.page_count（1–20000 或空）。 */
  page_count: number | null;
  /** 出版社；仅图书写入 books.publisher。 */
  publisher: string | null;
  /** 规范化 ISBN；仅图书写入 books.isbn（10／13 位或空）。 */
  isbn: string | null;
  collections?: string[];
};

const nameFieldLabels: Record<string, string> = {
  genres: "类型",
  languages: "语言",
  regions: "地区",
  collections: "系列",
};

const creditFieldLabels: Record<string, string> = {
  actors: "演员",
  directors: "导演",
  artists: "艺人",
  lyricists: "作词",
  composers: "作曲",
  authors: "作者",
};

/** 校验封面 URL：影视限 TMDB；音乐另接受 iTunes／CAA／archive.org；图书另接受 Open Library／Google Books（与 CSP 一致）。 */
export function assertCoverUrl(cover_url: string, type: ManagedMediaType) {
  let url: URL;
  try {
    url = new URL(cover_url);
  } catch {
    throw new Error("封面地址必须是有效的 HTTPS 地址。");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error(
      type === "album" || type === "music" || type === "book"
        ? "封面请使用 HTTPS 图片地址。"
        : "封面请使用 TMDB HTTPS 图片地址。",
    );
  }
  if (type === "album" || type === "music") {
    if (!isAllowedCoverHost(url.hostname)) throw new Error("封面请使用 iTunes、Cover Art Archive 或 TMDB 图片地址。");
    return;
  }
  if (type === "book") {
    if (url.hostname === "image.tmdb.org" && url.pathname.startsWith("/t/p/")) return;
    if (isAllowedBookCoverHost(url.hostname)) return;
    throw new Error("封面请使用 Open Library、Google Books 或 TMDB 图片地址。");
  }
  // 与 CSP 的 img-src 和 lib/tmdb-image.ts 的尺寸换算一致，其他地址浏览器不会加载。
  if (url.hostname !== "image.tmdb.org" || !url.pathname.startsWith("/t/p/")) {
    throw new Error("封面请使用 TMDB HTTPS 图片地址。");
  }
}

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
  /** 一行一个名称，保留名字里的逗号，并去除重复条目。max 覆盖默认上限（如曲目类型最多 2）。 */
  function names(key: string, max = MAX_NAMES) {
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
    if (values.length > max) throw new Error(`${label}最多 ${max} 个，当前 ${values.length} 个。`);
    return values;
  }
  /** 每行「人物 ID<Tab>姓名<Tab>角色」，ID 与角色可留空，无制表符的行视为仅有姓名；同一人物只保留第一行，无 ID 时按姓名去重。 */
  function credits(key: string): ActorCredit[] {
    // 不整体 trim，首行空 ID 的前导制表符是格式的一部分。
    const raw = form.get(key) ?? "";
    const label = creditFieldLabels[key] ?? key;
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
  const needsParentNumber = type === "tv_season" || type === "tv_episode" || type === "music";
  if (needsParentNumber && (!parent_id || number === null))
    throw new Error(type === "music" ? "请指定所属专辑和曲序。" : "请指定上级条目和季／集编号。");
  if (id && id === parent_id) throw new Error("不能把条目设为自己的上级。");
  // 曲目／季／单集不设自身封面。不读取、不校验提交的 cover_url，新建和更新都写入 null。
  // 这里不改已有行；只有之后再次保存时，数据库才会按这份 payload 把封面写成 null。
  const skipOwnCover = type === "tv_season" || type === "tv_episode" || type === "music";
  const cover_url = coverUrlForSave(type as ManagedMediaType, skipOwnCover ? null : string("cover_url", 2000));
  if (cover_url) assertCoverUrl(cover_url, type as ManagedMediaType);
  const isDerived = type === "tv_show" || type === "tv_season" || type === "album";
  const release_date = isDerived && type !== "album" ? null : string("release_date");
  if (
    release_date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(release_date) ||
      !Number.isFinite(Date.parse(release_date)) ||
      new Date(release_date).toISOString().slice(0, 10) !== release_date)
  )
    throw new Error("发行日期无效。");
  // 专辑评分由曲目汇总，不写入自身 tracking；电视节目／季同理。
  const rating = type === "tv_show" || type === "tv_season" || type === "album" ? null : numeric("rating", 10);
  if (rating !== null && Math.abs(rating * 10 - Math.round(rating * 10)) > 1e-8)
    throw new Error("评分最多保留一位小数。");
  // 有评分即看过、没有评分即没看过，不再单独选择观看状态；忽略提交的 status，旧页面也不会写出不一致的记录。
  // 电视节目、季与专辑没有评分，状态恒为 want_to_watch，仅用于通过校验，数据库不为它们保存 tracking。
  // 图书可显式提交想读／在读／读过；未提交合法状态时回退为没评分→想读、有评分→读过。
  const isBook = type === "book";
  const submittedStatus = string("status");
  let effectiveStatus: "watched" | "want_to_watch" | "in_progress" = rating !== null ? "watched" : "want_to_watch";
  if (isBook) {
    if (submittedStatus === "watched" || submittedStatus === "want_to_watch" || submittedStatus === "in_progress") {
      effectiveStatus = submittedStatus;
    }
  }
  const isTvChild = type === "tv_season" || type === "tv_episode";
  const isMusicTrack = type === "music";
  const isAlbum = type === "album";
  const artists = isAlbum || isMusicTrack ? credits("artists").map(({ id, name }) => ({ id, name })) : [];
  const lyricists = isMusicTrack ? credits("lyricists").map(({ id, name }) => ({ id, name })) : [];
  const composers = isMusicTrack ? credits("composers").map(({ id, name }) => ({ id, name })) : [];
  const authors = isBook ? credits("authors").map(({ id, name }) => ({ id, name })) : [];
  const label = isAlbum ? string("label", 200) : null;
  const publisher = isBook ? string("publisher", 200) : null;
  let page_count: number | null = null;
  let isbn: string | null = null;
  if (isBook) {
    page_count = numeric("page_count", 20000, true);
    if (page_count === 0) throw new Error("页数须为 1–20000 的整数，或留空。");
    const rawIsbn = string("isbn", 32);
    if (rawIsbn) {
      isbn = normalizeIsbn(rawIsbn);
      if (!isbn) throw new Error("ISBN 须为 10 位（末位可 X）或 13 位数字，可含空格或连字符。");
    }
  }
  // 曲目时长以秒计（1–7200，可空）；影视片长仍为分钟（0–100000）；图书不写 runtime。
  let runtime: number | null;
  if (type === "tv_show" || type === "tv_season" || type === "album" || isBook) {
    runtime = null;
  } else if (type === "music") {
    runtime = numeric("runtime", 7200, true);
    if (runtime === 0) throw new Error("曲目时长须为 1–7200 秒的整数，或留空。");
  } else {
    runtime = numeric("runtime", 100000, true);
  }
  return {
    id,
    type: type as ManagedMediaType,
    title,
    alternate_title: string("alternate_title"),
    summary: string("summary", 20000),
    cover_url,
    release_date: type === "tv_show" || type === "tv_season" ? null : release_date,
    runtime,
    parent_id,
    number,
    status: effectiveStatus,
    rating,
    // 曲目可有最多 2 个类型；季／集仍不写类型。专辑／影视／图书上限仍为 MAX_NAMES。
    genres: isTvChild ? [] : names("genres", isMusicTrack ? 2 : MAX_NAMES),
    // 专辑可设语言／地区；图书可设地区（语言原本已支持）。曲目与季／集仍清空。
    languages: isTvChild || isMusicTrack ? [] : names("languages"),
    regions: isTvChild || isMusicTrack ? [] : names("regions"),
    actors: isTvChild || isMusicTrack || isAlbum || isBook ? [] : credits("actors"),
    directors:
      isTvChild || isMusicTrack || isAlbum || isBook ? [] : credits("directors").map(({ id, name }) => ({ id, name })),
    artists,
    lyricists,
    composers,
    authors,
    label,
    page_count,
    publisher,
    isbn,
    collections: isTvChild || isMusicTrack ? [] : names("collections"),
  };
}
