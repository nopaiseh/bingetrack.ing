import { isMediaId } from "@/lib/functions/media-id";

export const mediaTypes = { movie: "电影", tv_series: "剧集", tv_season: "季", tv_episode: "集" } as const;
export type ManagedMediaType = keyof typeof mediaTypes;
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
  status: "watched" | "want_to_watch";
  rating: number | null;
  genres: string[];
  languages: string[];
  regions: string[];
  actors: string[];
  directors: string[];
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
    if (!Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) throw new Error("时长、评分或编号超出有效范围。");
    return value;
  }
  /** 一行一个名称，保留名字里的逗号，并去除重复条目。 */
  function names(key: string) {
    const values = [...new Set((string(key, 10000) ?? "").split(/\r?\n/).map(/* 去除每行首尾空白。 */ value => value.trim()).filter(Boolean))];
    if (values.length > 100 || values.some(/* 每个名称最多 200 字符。 */ value => value.length > 200)) throw new Error("关联名称过多或过长。");
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
  if ((type === "tv_season" || type === "tv_episode") && (!parent_id || number === null)) throw new Error("请指定上级条目和季／集编号。");
  if (id && id === parent_id) throw new Error("不能把条目设为自己的上级。");
  const cover_url = string("cover_url", 2000);
  if (cover_url) {
    let url: URL;
    try { url = new URL(cover_url); } catch { throw new Error("封面地址必须是有效的 TMDB HTTPS 地址。"); }
    if (url.protocol !== "https:" || !(url.hostname === "tmdb.org" || url.hostname.endsWith(".tmdb.org")) || url.username || url.password || url.port) throw new Error("封面请使用 TMDB HTTPS 图片地址。");
  }
  const release_date = string("release_date");
  if (release_date && (!/^\d{4}-\d{2}-\d{2}$/.test(release_date) || !Number.isFinite(Date.parse(release_date)) || new Date(release_date).toISOString().slice(0, 10) !== release_date)) throw new Error("发行日期无效。");
  const status = string("status");
  if (status !== "watched" && status !== "want_to_watch") throw new Error("请选择看过或没看过。");
  const rating = numeric("rating", 10);
  if (rating !== null && Math.abs(rating * 10 - Math.round(rating * 10)) > 1e-8) throw new Error("评分最多保留一位小数。");
  return { id, type: type as ManagedMediaType, title, alternate_title: string("alternate_title"), summary: string("summary", 20000), cover_url, release_date, runtime: numeric("runtime", 100000), parent_id, number, status, rating,
    genres: names("genres"), languages: names("languages"), regions: names("regions"), actors: names("actors"), directors: names("directors") };
}
