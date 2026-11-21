import Link from "next/link";
import type { ReactNode } from "react";

type CatalogEmptyStateProps = {
  /**
   * 单行说明（专辑空状态）：与既有「还没有专辑。」同款 muted 段落。
   * 与 title 二选一；有 title 时走标题 + 说明 + 可选链接。
   */
  message?: ReactNode;
  /** 空状态标题（电影／电视）。 */
  title?: string;
  /** 标题下方的短说明。 */
  description?: string;
  /** 文字链目标，通常指向搜索页。 */
  ctaHref?: string;
  /** 文字链可见名称（不含箭头；箭头由组件以装饰性方式追加）。 */
  ctaLabel?: string;
};

const panelClass = "rounded-2xl border border-dashed border-[var(--border)] px-6 text-center";

/**
 * 目录空状态：虚线面板，与专辑页「还没有专辑。」共用外壳。
 * 专辑只传 message；电影／电视传 title、description 与文字链 CTA。
 */
export default function CatalogEmptyState({ message, title, description, ctaHref, ctaLabel }: CatalogEmptyStateProps) {
  if (title) {
    return (
      <div className={`${panelClass} py-14 sm:py-16`}>
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description ? (
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-secondary">{description}</p>
        ) : null}
        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            className="focus-ring mt-5 inline-flex min-h-10 items-center rounded-sm text-sm font-medium text-[var(--accent-hover)] underline-offset-4 hover:underline"
          >
            {ctaLabel} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${panelClass} py-16`}>
      <p className="text-sm text-fg-muted">{message}</p>
    </div>
  );
}
