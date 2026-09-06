import Link from "next/link";

type SearchTagCategory =
  | "genre"
  | "region"
  | "language"
  | "director"
  | "cast"
  | "series";

/** 将导演、演员或系列名编码为分类关键词搜索；其他分类使用对应筛选参数。 */
function getSearchHref(label: string, category: SearchTagCategory) {
  if (category === "director" || category === "cast" || category === "series") {
    const type = category === "director"
      ? "导演"
      : category === "cast"
        ? "演员"
        : "系列";
    const params = new URLSearchParams({
      q: label,
      type,
    });
    return `/search?${params.toString()}`;
  }

  return `/search?${category}=${encodeURIComponent(label)}`;
}

/** 将标签文本渲染为链接，点击后进入对应分类的搜索结果。 */
export default function SearchTag({
  label,
  category,
}: {
  label: string;
  category: SearchTagCategory;
}) {
  return (
    <Link
      href={getSearchHref(label, category)}
      className="surface-subtle inline-flex items-center rounded-lg border border-white/8 px-3.5 py-1.5 text-sm font-medium tracking-wide text-neutral-300 transition-all duration-300 hover:border-white/20 hover:bg-white/8 hover:text-white hover:shadow-[0_0_12px_rgba(255,255,255,0.05)]"
    >
      {label}
    </Link>
  );
}
