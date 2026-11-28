/** 华语／华人地区作品用「又名」，其余用「原名」。缺语言与地区时回退「原名」。 */

const CHINESE_LANGUAGES = new Set([
  "华语",
  "普通话",
  "粤语",
  "闽南语",
  "国语",
  "zh",
  "cmn",
  "yue",
  "nan",
]);

const CHINESE_REGIONS = new Set(["中国", "中国大陆", "台湾", "香港", "澳门"]);

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function isChineseLanguage(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  if (CHINESE_LANGUAGES.has(raw)) return true;
  return CHINESE_LANGUAGES.has(normalizeToken(raw));
}

function isChineseRegion(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  return CHINESE_REGIONS.has(raw);
}

/** 根据语言／地区选择副标题与侧栏的别名标签。 */
export function alternateTitleLabel(input: {
  languages?: readonly string[] | null;
  regions?: readonly string[] | null;
}): "又名" | "原名" {
  const languages = input.languages ?? [];
  const regions = input.regions ?? [];
  if (languages.some(isChineseLanguage) || regions.some(isChineseRegion)) return "又名";
  return "原名";
}
