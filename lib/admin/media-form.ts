import { isMediaId } from "@/lib/functions/media-id";
import { mediaTypes, type ManagedMediaType } from "@/lib/media-types";

export { mediaTypes, type ManagedMediaType };

/** 管理端可接受的封面主机（与 CSP img-src 对齐）。 */
const COVER_HOSTS = new Set(["image.tmdb.org", "coverartarchive.org", "archive.org"]);

function isAllowedCoverHost(hostname: string) {
  if (COVER_HOSTS.has(hostname)) return true;
  // iTunes／Apple 封面：*.mzstatic.com；archive.org 镜像：*.archive.org
  return hostname.endsWith(".mzstatic.com") || hostname.endsWith(".archive.org");
}

/**
 * 决定写入媒体条目的封面。
 * 季忽略提交值，新建和更新都存 null。其余类型保留提交的封面。
 */
export function coverUrlForSave(type: ManagedMediaType, supplied: string | null): string | null {
  return type === "tv_season" ? null : supplied;
}

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
  /** 专辑／曲目艺人（media_credits.role=artist）。 */
  artists: PersonRef[];
  /** 曲目作词（media_credits.role=lyricist）。 */
  lyricists: PersonRef[];
  /** 曲目作曲（media_credits.role=composer）。 */
  composers: PersonRef[];
  /** 唱片公司；仅专辑写入 music_albums.label。 */
  label: string | null;
  collections?: string[];
};

/** 校验封面 URL：影视限 TMDB；音乐另接受 iTunes／CAA／archive.org（与 CSP 一致）。 */
export function assertCoverUrl(cover_url: string, type: ManagedMediaType) {
  let url: URL;
  try {
    url = new URL(cover_url);
  } catch {
    throw new Error("封面地址必须是有效的 HTTPS 地址。");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error(
      type === "album" || type === "music" ? "封面请使用 HTTPS 图片地址。" : "封面请使用 TMDB HTTPS 图片地址。",
    );
  }
  if (type === "album" || type === "music") {
    if (!isAllowedCoverHost(url.hostname)) throw new Error("封面请使用 iTunes、Cover Art Archive 或 TMDB 图片地址。");
    return;
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
  /** 一行一个名称，保留名字里的逗号，并去除重复条目。 */
  function names(key: string) {
    const values = [
      ...new Set(
        (string(key, 10000) ?? "")
          .split(/\r?\n/)
          .map(/* 去除每行首尾空白。 */ (value) => value.trim())
          .filter(Boolean),
      ),
    ];
    if (values.length > 100 || values.some(/* 每个名称最多 200 字符。 */ (value) => value.length > 200))
      throw new Error("关联名称过多或过长。");
    return values;
  }
  /** 每行「人物 ID<Tab>姓名<Tab>角色」，ID 与角色可留空，无制表符的行视为仅有姓名；同一人物只保留第一行，无 ID 时按姓名去重。 */
  function credits(key: string): ActorCredit[] {
    // 不整体 trim，首行空 ID 的前导制表符是格式的一部分。
    const raw = form.get(key) ?? "";
    if (typeof raw !== "string" || raw.length > 30000) throw new Error("关联名称过多或过长。");
    const seen = new Set<string>();
    const values = raw.split(/\r?\n/).flatMap(
      /* 拆出人物 ID、姓名与角色并去除重复人物。 */ (line) => {
        const [rawId, rawName = "", ...rest] = line.includes("\t") ? line.split("\t") : ["", line];
        const id = rawId.trim() || null;
        const name = rawName.trim();
        if (id && !isMediaId(id)) throw new Error("人物 ID 格式不正确。");
        const identity = id ?? `name:${name}`;
        if (!name || seen.has(identity)) return [];
        seen.add(identity);
        return [{ id, name, character: rest.join(" ").trim() || null }];
      },
    );
    if (
      values.length > 100 ||
      values.some(
        /* 姓名与角色各最多 200 字符。 */ (value) => value.name.length > 200 || (value.character?.length ?? 0) > 200,
      )
    )
      throw new Error("关联名称过多或过长。");
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
  // 季不设海报。不读取、不校验提交的 cover_url，新建和更新都写入 null，不采用新的封面地址。
  // 这里不改已有行；只有之后再次保存该季时，数据库才会按这份 payload 把封面写成 null。
  const cover_url = coverUrlForSave(type as ManagedMediaType, type === "tv_season" ? null : string("cover_url", 2000));
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
  const effectiveStatus: "watched" | "want_to_watch" = rating !== null ? "watched" : "want_to_watch";
  const isTvChild = type === "tv_season" || type === "tv_episode";
  const isMusicTrack = type === "music";
  const isAlbum = type === "album";
  const artists = isAlbum || isMusicTrack ? credits("artists").map(({ id, name }) => ({ id, name })) : [];
  const lyricists = isMusicTrack ? credits("lyricists").map(({ id, name }) => ({ id, name })) : [];
  const composers = isMusicTrack ? credits("composers").map(({ id, name }) => ({ id, name })) : [];
  const label = isAlbum ? string("label", 200) : null;
  // 曲目时长以秒计（存储与展示一致）；影视片长仍为分钟。
  const runtime = type === "tv_show" || type === "tv_season" || type === "album" ? null : numeric("runtime", 100000);
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
    genres: isTvChild || isMusicTrack ? [] : names("genres"),
    languages: isTvChild || isMusicTrack || isAlbum ? [] : names("languages"),
    regions: isTvChild || isMusicTrack || isAlbum ? [] : names("regions"),
    actors: isTvChild || isMusicTrack || isAlbum ? [] : credits("actors"),
    directors: isTvChild || isMusicTrack || isAlbum ? [] : credits("directors").map(({ id, name }) => ({ id, name })),
    artists,
    lyricists,
    composers,
    label,
    collections: isTvChild || isMusicTrack ? [] : names("collections"),
  };
}
