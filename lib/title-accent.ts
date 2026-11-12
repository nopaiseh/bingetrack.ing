/** 与 globals.css 里 .letter-tile / 详情回退页头的 data-accent 档位数一致。 */
export const TITLE_ACCENT_COUNT = 6;

/** 取标题的第一个字素，空标题用间隔号，避免海报格里什么都没有。 */
export function titleInitial(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "·";
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return [...segmenter.segment(trimmed)][0]?.segment ?? trimmed[0];
}

/** 同一标题始终落到同一档颜色。用码点累加，不依赖运行时哈希随机。 */
export function titleAccentIndex(title: string, count = TITLE_ACCENT_COUNT): number {
  let hash = 0;
  for (const char of title.trim()) {
    const point = char.codePointAt(0) ?? 0;
    hash = (Math.imul(hash, 31) + point) >>> 0;
  }
  return count > 0 ? hash % count : 0;
}

/**
 * 页头水印用原名的最后一个词（Doomsday），没有拉丁字母时退回中文标题。
 * 只做展示，不参与数据。
 */
export function heroWatermark(title: string, alternate?: string | null): string {
  const source = alternate?.trim() || title.trim();
  const parts = source.split(/[\s:：·|/]+/).filter(Boolean);
  const word = parts.at(-1) ?? source;
  if (!word) return "";
  return /[A-Za-z]/.test(word) ? word.toUpperCase() : word;
}
