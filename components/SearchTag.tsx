import Link from "next/link";

type SearchTagCategory = "genre" | "region" | "language" | "director" | "cast" | "series";

/** 将导演、演员编码为 creditRole 关键词搜索；系列用 type=series；其他分类用对应筛选参数。 */
function getSearchHref(label: string, category: SearchTagCategory) {
  if (category === "director" || category === "cast") {
    const creditRole = category === "director" ? "director" : "actor";
    return `/search?${new URLSearchParams({ q: label, creditRole }).toString()}`;
  }
  if (category === "series") {
    return `/search?${new URLSearchParams({ q: label, type: "series" }).toString()}`;
  }

  return `/search?${category}=${encodeURIComponent(label)}`;
}

/** 将标签文本渲染为链接，点击后进入对应分类的搜索结果。 */
export default function SearchTag({
  label,
  category,
  note,
}: {
  label: string;
  category: SearchTagCategory;
  /** 附在名称后的次要说明（如饰演角色），不参与搜索。 */
  note?: string;
}) {
  return (
    <Link
      href={getSearchHref(label, category)}
      className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1.5 text-sm font-medium text-fg-secondary transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)] hover:text-fg"
    >
      {label}
      {note && (
        <>
          {" "}
          <span className="ml-1.5 font-normal text-fg-subtle">{note}</span>
        </>
      )}
    </Link>
  );
}
