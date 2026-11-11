const GENERIC_SEASON_NAME = /^第[0-9一二三四五六七八九十百]+季$/;

/** 去掉空白后再比较，避免「第 1 季」和「第1季」被当成两个名字。 */
function compactSeasonName(value: string): string {
  return value.replace(/\s+/g, "");
}

/**
 * 季列表的统一标题。
 * 主标题始终来自季序号；库里的原标题如果不是「第 N 季」这种通用名，就留作副标题。
 */
export function seasonListLabel(season: {
  seasonNumber: number;
  title: string;
  alternateTitle?: string | null;
}): { title: string; subtitle: string | null } {
  const title = `第 ${season.seasonNumber} 季`;
  const stored = season.title.trim();
  const alternate = season.alternateTitle?.trim() ?? "";
  const subtitle = [stored, alternate].find((value) => {
    const compact = compactSeasonName(value);
    return compact.length > 0 && compact !== compactSeasonName(title) && !GENERIC_SEASON_NAME.test(compact);
  });
  return { title, subtitle: subtitle ?? null };
}
