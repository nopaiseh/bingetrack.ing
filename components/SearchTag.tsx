import Link from "next/link";

type SearchTagCategory =
  | "genre"
  | "region"
  | "language"
  | "director"
  | "cast"
  | "series";

function getSearchHref(label: string, category: SearchTagCategory) {
  if (category === "director" || category === "cast") {
    const params = new URLSearchParams({
      q: label,
      type: category === "director" ? "导演" : "演员",
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
      className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-neutral-300 text-sm font-medium tracking-wide transition-all duration-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20 hover:shadow-[0_0_12px_rgba(255,255,255,0.05)]"
    >
      {label}
    </Link>
  );
}
