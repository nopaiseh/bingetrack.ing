import type { ReactNode } from "react";

/** 管理页的紧凑页头：一个 h1，说明在标题下，操作靠右。 */
export default function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  descriptionClassName = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** 标题上方的返回链接或面包屑。 */
  eyebrow?: ReactNode;
  descriptionClassName?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-sm text-fg-secondary">{eyebrow}</div> : null}
        <h1 className="admin-heading break-words">{title}</h1>
        {description ? <p className={`mt-1 max-w-3xl text-sm leading-6 text-fg-secondary ${descriptionClassName}`}>{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** 列表页的「内容 / 当前栏目」。当前页不再做成链接，避免和侧栏的当前项重复跳转。 */
export function AdminCrumb({ current }: { current: string }) {
  return (
    <nav aria-label="面包屑">
      <ol className="flex items-center gap-1.5">
        <li>内容</li>
        <li aria-hidden="true">/</li>
        <li>{current}</li>
      </ol>
    </nav>
  );
}
