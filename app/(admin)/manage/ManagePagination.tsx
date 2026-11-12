import Link from "next/link";
import { paginationItems } from "@/lib/pagination";

/** 管理列表分页：显示总页数，并提供首页、末页及当前页附近的页码直接跳转。 */
export default function ManagePagination({
  page,
  totalPages,
  params,
  basePath = "/manage",
  label = "管理列表分页",
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string>;
  basePath?: string;
  label?: string;
  /** 传入后在分页条左侧显示「第 1–25 条，共 N 条」。 */
  total?: number;
  pageSize?: number;
}) {
  if (totalPages <= 1 && total == null) return null;
  const from = total ? (page - 1) * (pageSize ?? 0) + 1 : 0;
  const to = total ? Math.min(page * (pageSize ?? 0), total) : 0;

  /** 保留当前筛选条件生成目标页地址。 */
  const pageUrl = (target: number) => `${basePath}?${new URLSearchParams({ ...params, page: String(target) })}`;
  const arrowClass = "surface-control flex min-h-10 min-w-10 items-center justify-center rounded-xl p-2.5 text-fg-secondary transition-all hover:text-white";

  return (
    <nav aria-label={label} className={total == null ? "mt-6 flex flex-col items-center gap-3" : "admin-pager"}>
      {total == null ? null : (
        <p className="text-sm text-fg-secondary">
          {total === 0 ? "共 0 条" : `第 ${from.toLocaleString("en-US")}–${to.toLocaleString("en-US")} 条，共 ${total.toLocaleString("en-US")} 条`}
          {pageSize ? <span className="ml-3">每页 {pageSize}</span> : null}
        </p>
      )}
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
              className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl px-3 py-2 text-center text-sm transition-all ${
                item === page
                  ? "filter-option-active shadow-md"
                  : "surface-muted border border-white/10 text-fg-secondary hover:bg-white/10 hover:text-white"
              }`}
            >
              {item}
            </Link>
          ) : (
            <span key={item} className="px-1 text-sm text-fg-subtle" aria-hidden="true">…</span>
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
      <p className={total == null ? "text-sm text-neutral-400" : "sr-only"}>第 {page} / {totalPages} 页</p>
    </nav>
  );
}
