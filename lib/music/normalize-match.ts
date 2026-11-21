/**
 * 音乐封面匹配用的标题／艺人规范化：简繁统一、大小写、空白与标点、常见后缀。
 * 仅用于比较，不改变入库原文。
 */

import { sify } from "chinese-conv";

/** 比较前去掉的括号／破折号后缀（Live、Single、feat. 等）。 */
const TITLE_SUFFIX =
  /\s*[([（【［]\s*(?:live(?:\s+version)?|acoustic(?:\s+version)?|remix|deluxe(?:\s+edition)?|extended(?:\s+version)?|remaster(?:ed)?|explicit|radio\s+edit|bonus\s+track)\s*[)\]）】］]\s*$/i;
const SINGLE_SUFFIX = /\s*[-–—]\s*single\s*$/i;
const FEAT_SUFFIX = /\s*[([（【［-]?\s*(?:feat\.?|ft\.?|featuring)\s+.+?(?:[)\]）】］]|$)/i;

/** 全角标点／空白 → 半角或去掉，便于跨区比较。 */
const FULLWIDTH_PUNCT: Record<string, string> = {
  "　": " ",
  "，": ",",
  "。": ".",
  "、": ",",
  "；": ";",
  "：": ":",
  "！": "!",
  "？": "?",
  "（": "(",
  "）": ")",
  "【": "[",
  "】": "]",
  "『": '"',
  "』": '"',
  "「": '"',
  "」": '"',
  "《": '"',
  "》": '"',
  "／": "/",
  "－": "-",
  "—": "-",
  "–": "-",
  "‧": ".",
  "・": ".",
  "·": ".",
  "＆": "&",
};

/** 艺人合作者分隔：&、/、、、逗号、feat. */
const ARTIST_SPLIT = /\s*(?:&|／|\/|、|,|，|\+|feat\.?|ft\.?|featuring)\s*/i;

/** 简繁统一为简体，便于「周杰伦」对上「周杰倫／周傑倫」。 */
export function unifyChineseScript(text: string): string {
  return sify(text);
}

/** 去掉比较用后缀，可多次剥除。 */
export function stripMatchSuffixes(text: string): string {
  let result = text.trim();
  for (let i = 0; i < 4; i += 1) {
    const next = result.replace(TITLE_SUFFIX, "").replace(SINGLE_SUFFIX, "").replace(FEAT_SUFFIX, "").trim();
    if (next === result) break;
    result = next;
  }
  return result;
}

/**
 * 生成匹配键：简繁统一 → 小写 → 全半角标点归一 → 去空白与标点噪音 → 去后缀。
 */
export function normalizeMusicMatchKey(text: string | null | undefined): string {
  if (!text) return "";
  let value = unifyChineseScript(text).normalize("NFKC").toLowerCase();
  value = [...value].map((ch) => FULLWIDTH_PUNCT[ch] ?? ch).join("");
  value = stripMatchSuffixes(value);
  // 去掉剩余标点与空白，只留字母数字与 CJK。
  value = value.replace(/[^\p{L}\p{N}]+/gu, "");
  return value;
}

/** 规范化后标题是否相等。 */
export function titlesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeMusicMatchKey(left);
  const b = normalizeMusicMatchKey(right);
  return Boolean(a) && a === b;
}

/** 拆分合作者名单。 */
export function splitArtistNames(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  // 先按合作者分隔符拆，再各自规范化，避免 & 被匹配键剥掉。
  const raw = unifyChineseScript(text).normalize("NFKC").toLowerCase();
  const parts = raw
    .split(ARTIST_SPLIT)
    .map((part) => normalizeMusicMatchKey(part))
    .filter(Boolean);
  if (parts.length > 0) return [...new Set(parts)];
  const whole = normalizeMusicMatchKey(text);
  return whole ? [whole] : [];
}

/**
 * 有歌手输入时：结果艺人规范化后等于或包含输入，或按 & 拆分后各方能对上。
 * 无歌手输入时视为通过（只比标题）。
 */
export function artistMatches(
  inputArtist: string | null | undefined,
  resultArtist: string | null | undefined,
): boolean {
  const inputKey = normalizeMusicMatchKey(inputArtist);
  if (!inputKey) return true;
  const resultKey = normalizeMusicMatchKey(resultArtist);
  if (!resultKey) return false;
  if (resultKey === inputKey || resultKey.includes(inputKey) || inputKey.includes(resultKey)) return true;

  const inputParts = splitArtistNames(inputArtist);
  const resultParts = splitArtistNames(resultArtist);
  if (inputParts.length === 0 || resultParts.length === 0) return false;
  return inputParts.every((part) =>
    resultParts.some((candidate) => candidate === part || candidate.includes(part) || part.includes(candidate)),
  );
}
