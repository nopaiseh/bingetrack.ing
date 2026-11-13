/** 管理列表每页条数。三个列表页的 .range() 已按 25 条取数，这里只把同一个窗口显示出来。 */
export const ADMIN_LIST_PAGE_SIZE = 25;

export type AdminListOption = { value: string; label: string };

export type AdminListSearch = { name: string; label: string; placeholder: string; value: string };

export type AdminListChips = { name: string; label: string; value: string; options: AdminListOption[] };

export type AdminListSelect = { name: string; label: string; value: string; options: AdminListOption[] };

export type AdminListColumn = { key: string; label: string; className?: string };

export type AdminListCell = { key: string; label: string; value: string };

export type AdminListStatus = { label: string; tone: "watched" | "watching" | "want" | "neutral" };

export type AdminListTrailing = { href: string; label: string; icon: string };

export type AdminListRow = {
  id: string;
  href: string;
  title: string;
  /** 桌面标题下的第二行，例如原名。 */
  subtitle?: string | null;
  /** 窄屏标题下的第二行；桌面改由分列显示。 */
  detail?: string | null;
  /** 季、集所属节目等，两种宽度都显示。 */
  meta?: string | null;
  imageUrl?: string | null;
  cells: AdminListCell[];
  status?: AdminListStatus | null;
  trailing?: AdminListTrailing | null;
};

export type AdminBulkAction = {
  id: string;
  label: string;
  icon: string;
  destructive?: boolean;
};

/** 深色底上的白字，对比度均高于 4.5:1。同一标题始终落在同一色块。 */
export const LIST_TINTS = ["#14532d", "#7f1d1d", "#78350f", "#1e3a8a", "#134e4a", "#312e81", "#7c2d12", "#4a044e"] as const;

export function listTint(title: string) {
  let hash = 2166136261;
  for (const char of title) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return LIST_TINTS[(hash >>> 0) % LIST_TINTS.length];
}

export function listInitial(title: string) {
  const char = [...title.trim()][0];
  return char ? char.toLocaleUpperCase("zh-CN") : "·";
}

/** 季、单集、系列、类型、地区、语言和报告还没有批量接口。 */
export const mediaBulkActions: AdminBulkAction[] = [
  { id: "watched", label: "已看", icon: "i-material-symbols-check-circle-outline-rounded" },
  { id: "want", label: "想看", icon: "i-material-symbols-bookmark-outline-rounded" },
  { id: "delete", label: "删除", icon: "i-material-symbols-delete-outline-rounded", destructive: true },
];

/** 关联资料的删除会跳转并要求输入全名，不能对勾选行循环调用。 */
export const referenceBulkActions: AdminBulkAction[] = [
  { id: "delete", label: "删除", icon: "i-material-symbols-delete-outline-rounded", destructive: true },
];

/** 报告行没有按勾选删除的接口；整份闲置删除仍留在列表下方，不接到勾选栏。 */
export const reportBulkActions: AdminBulkAction[] = [
  { id: "delete", label: "删除", icon: "i-material-symbols-delete-outline-rounded", destructive: true },
];

/** 生成可分享的列表地址。空值和默认值不写入，页码由分页组件单独追加。 */
export function adminListHref(basePath: string, params: Record<string, string | undefined>, defaults: Record<string, string> = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || value === defaults[key]) continue;
    search.set(key, value);
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
