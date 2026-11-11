import Link from "next/link";

export interface CatalogStat {
  label: string;
  value: number;
  href: string;
}

/** 去掉数量为 0 的统计。全是 0 时保留第一张总览，避免目录顶部空白，同时不链到空的搜索结果。 */
export function visibleCatalogStats(items: CatalogStat[]): CatalogStat[] {
  const visible = items.filter((item) => item.value > 0);
  return visible.length > 0 ? visible : items.slice(0, 1);
}

/** 按可见张数选择列数，避免 5 张里藏一张 0 之后，桌面端还留着一条空列。 */
function gridClass(count: number): string {
  if (count >= 5) return "grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
  if (count === 3) return "grid-cols-2 sm:grid-cols-3";
  if (count === 1) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-2 lg:grid-cols-4";
}

/** 两列布局下，奇数的最后一张拉满一行，不再单独占半格。 */
function orphanClass(count: number): string {
  if (count % 2 === 0 || count <= 1) return "";
  return count >= 5 ? "max-md:col-span-2" : "max-sm:col-span-2";
}

/** 电影和电视目录共用的统计卡片。数量为 0 的项不渲染，因此也不会点进空结果。 */
export default function CatalogStatGrid({ items }: { items: CatalogStat[] }) {
  const visible = visibleCatalogStats(items);
  const muted = visible.length === 1 && visible[0].value <= 0;

  return (
    <div className={`mb-8 grid gap-3.5 sm:gap-4 md:mb-10 ${gridClass(visible.length)}`}>
      {visible.map(/* 一项统计：有数量时可点进对应列表，全零时只作说明。 */ (stat, index) => {
        const span = index === visible.length - 1 ? orphanClass(visible.length) : "";
        const body = (
          <>
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-widest text-fg-secondary transition-colors group-hover:text-fg">
                {stat.label}
              </h2>
              {!muted && (
                <span className="i-material-symbols-arrow-outward-rounded size-3.5 text-fg-subtle transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" aria-hidden="true" />
              )}
            </div>
            <p className="font-mono text-2xl tracking-tight text-white transition-colors group-hover:text-[var(--accent-hover)] sm:text-3xl">
              {stat.value}
            </p>
          </>
        );
        const className = `surface-card group flex flex-col justify-between rounded-xl p-3.5 sm:p-4.5 ${span} ${
          muted ? "opacity-80" : "interactive-card cursor-pointer transition-all duration-300 hover:scale-[1.02]"
        }`;

        if (muted) {
          return <div key={stat.label} className={className}>{body}</div>;
        }

        return (
          <Link key={stat.label} href={stat.href} className={className}>
            {body}
          </Link>
        );
      })}
    </div>
  );
}
