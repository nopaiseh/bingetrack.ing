import type { AdminListPage, ChildListItem, ParsedAdminChildQuery } from "@/lib/admin/list-params";

export type AdminChildListResult = AdminListPage<ChildListItem> &
  Pick<ParsedAdminChildQuery, "q" | "sort" | "status" | "parent">;

export type QueryError = { code?: string } | null;

export type OrderOptions = { ascending: boolean; nullsFirst?: boolean };
