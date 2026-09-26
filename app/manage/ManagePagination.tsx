import Link from "next/link";
import { paginationItems } from "@/lib/pagination";

/** 管理列表分页：显示总页数，并提供首页、末页及当前页附近的页码直接跳转。 */
export default function ManagePagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  /** 保留当前筛选条件生成目标页地址。 */
  const pageUrl = (target: number) => `/manage?${new URLSearchParams({ ...params, page: String(target) })}`;
  const arrowClass = "surface-control flex items-center rounded-xl p-2.5 text-white/70 transition-all hover:bg-white/10 hover:text-white";

  return (
    <nav aria-label="管理列表分页" className="mt-6 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {page > 1 ? (
          <Link href={pageUrl(page - 1)} className={arrowClass} aria-label="上一页">
            <span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${arrowClass} pointer-events-none opacity-30`} aria-hidden="true">
            <span className="i-material-symbols-chevron-left-rounded inline-block size-4" />
          </span>
        )}
        {paginationItems(page, totalPages).map(/* 渲染一个页码链接或省略标记。 */ (item) =>
          typeof item === "number" ? (
            <Link
              key={item}
              href={pageUrl(item)}
              aria-label={`第 ${item} 页`}
              aria-current={item === page ? "page" : undefined}
              className={`min-w-10 rounded-xl px-3 py-2 text-center text-sm transition-all ${
                item === page
                  ? "filter-option-active shadow-md"
                  : "surface-muted border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item}
            </Link>
          ) : (
            <span key={item} className="px-1 text-sm text-white/50" aria-hidden="true">…</span>
          ),
        )}
        {page < totalPages ? (
          <Link href={pageUrl(page + 1)} className={arrowClass} aria-label="下一页">
            <span className="i-material-symbols-chevron-right-rounded inline-block size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${arrowClass} pointer-events-none opacity-30`} aria-hidden="true">
            <span className="i-material-symbols-chevron-right-rounded inline-block size-4" />
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-400">第 {page} / {totalPages} 页</p>
    </nav>
  );
}
