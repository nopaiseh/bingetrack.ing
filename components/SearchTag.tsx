import Link from "next/link";

type SearchTagCategory =
  | "genre"
  | "region"
  | "language"
  | "director"
  | "cast"
  | "series";

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
