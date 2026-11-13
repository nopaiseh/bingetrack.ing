"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import ManagePagination from "../ManagePagination";
import { deleteMovies, deletePeople, deleteTvShows, setMovieStatus, setTvShowStatus } from "../list-actions";
import type { BulkCounts } from "@/lib/admin/list-params";
import {
  adminListHref,
  listInitial,
  listTint,
  type AdminBulkAction,
  type AdminListChips,
  type AdminListColumn,
  type AdminListRow,
  type AdminListSearch,
  type AdminListSelect,
  type AdminListStatus,
} from "./model";

const SEARCH_DELAY = 300;

type AdminListProps = {
  basePath: string;
  /** 筛选栏不编辑、但必须留在地址里的参数，例如 type、parent。 */
  preserved: Record<string, string>;
  /** 与缺省相同的值不写入地址，避免分享链接带上 sort=date。 */
  defaults?: Record<string, string>;
  search: AdminListSearch;
  chips?: AdminListChips | null;
  selects?: AdminListSelect[];
  columns: AdminListColumn[];
  rows: AdminListRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pageParams: Record<string, string>;
  empty: string;
  /** 「已选 3 部」里的量词。 */
  noun: string;
  listLabel: string;
  /** 没有对应接口时渲染为禁用，并提示 Coming soon。 */
  actions: AdminBulkAction[];
  /** 电影、电视节目、人物走已合并的批量接口。已看与想看只提供给影视。 */
  wired?: "movie" | "tv_show" | "people";
  showStatus?: boolean;
};

function StatusChip({ status }: { status: AdminListStatus }) {
  return (
    <span className={`admin-status admin-status-${status.tone}`}>
      <span className="admin-status-dot" aria-hidden="true" />
      {status.label}
    </span>
  );
}

function allowedCover(src: string) {
  return src.startsWith("https://image.tmdb.org/t/p/") ? src : null;
}

function ListThumb({ src, title }: { src?: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const cover = src ? allowedCover(src) : null;
  if (!cover || failed) {
    return (
      <span className="admin-list-mark" style={{ backgroundColor: listTint(title) }} aria-hidden="true">
        {listInitial(title)}
      </span>
    );
  }
  return (
    <Image
      src={cover}
      alt=""
      width={36}
      height={36}
      className="admin-list-thumb"
      onError={() => setFailed(true)}
    />
  );
}

function ComingSoon({ action }: { action: AdminBulkAction }) {
  const tipId = useId();
  return (
    <span className="admin-soon" tabIndex={0} aria-describedby={tipId}>
      <button type="button" className={action.destructive ? "admin-danger" : ""} disabled>
        <span className={`${action.icon} size-5`} aria-hidden="true" />
        {action.label}
      </button>
      <span id={tipId} role="tooltip" className="admin-soon-tip">Coming soon</span>
    </span>
  );
}

/** 管理列表：输入即筛选并写入地址，紧凑行可勾选，批量操作在没有接口时保持禁用。 */
export default function AdminList({
  basePath,
  preserved,
  defaults = {},
  search,
  chips = null,
  selects = [],
  columns,
  rows,
  page,
  pageSize,
  total,
  totalPages,
  pageParams,
  empty,
  noun,
  listLabel,
  actions,
  wired,
  showStatus = false,
}: AdminListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const selectAllId = useId();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const initialFilters = readFilters(search, chips, selects);
  const draftRef = useRef(initialFilters);
  const timer = useRef<number | null>(null);
  const incomingKey = JSON.stringify(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [seenKey, setSeenKey] = useState(incomingKey);
  const [pendingSearch, setPendingSearch] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const rowKey = rows.map((row) => row.id).join("\n");
  const [seenRows, setSeenRows] = useState(rowKey);

  // 地址变化（后退、分享链接）时跟上服务端筛选；正在输入的搜索先保留，等停顿后再提交。
  if (incomingKey !== seenKey) {
    setSeenKey(incomingKey);
    if (!pendingSearch) setFilters(JSON.parse(incomingKey) as Record<string, string>);
  }
  if (rowKey !== seenRows) {
    setSeenRows(rowKey);
    setSelected(new Set());
  }

  useEffect(() => {
    draftRef.current = filters;
  }, [filters]);

  useEffect(() => {
    const box = selectAllRef.current;
    if (!box) return;
    box.indeterminate = selected.size > 0 && selected.size < rows.length;
  }, [selected, rows.length]);

  useEffect(() => () => {
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);

  function push(next: Record<string, string>) {
    const href = adminListHref(basePath, { ...preserved, ...next }, defaults);
    const current = new URL(window.location.href);
    const target = new URL(href, window.location.origin);
    if (sameLocation(target, current, pathname)) return;
    router.push(href, { scroll: false });
  }

  function commit(partial: Record<string, string>, debounce = false) {
    const next = { ...draftRef.current, ...partial };
    draftRef.current = next;
    setFilters(next);
    if (timer.current != null) window.clearTimeout(timer.current);
    if (!debounce) {
      setPendingSearch(false);
      push(next);
      return;
    }
    setPendingSearch(true);
    timer.current = window.setTimeout(() => {
      setPendingSearch(false);
      timer.current = null;
      push(draftRef.current);
    }, SEARCH_DELAY);
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((current) => (current.size === rows.length ? new Set() : new Set(rows.map((row) => row.id))));
  }

  async function runWired(actionId: string) {
    if (!wired || pendingAction) return;
    const ids = [...selected];
    if (ids.length === 0) return;
    if (actionId === "delete" && !window.confirm(deleteConfirm(wired, ids.length, noun))) return;
    setPendingAction(actionId);
    setNotice(null);
    try {
      const result = await runBulk(wired, actionId, ids);
      setNotice({ tone: result.failed > 0 && result.succeeded === 0 ? "error" : "ok", text: bulkNotice(actionId, result, noun) });
      if (result.succeeded > 0) router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "操作失败，请重试。" });
    } finally {
      setPendingAction(null);
    }
  }

  const columnClass = new Map(columns.map((column) => [column.key, column.className ?? ""]));
  const hasTrailing = rows.some((row) => row.trailing);

  return (
    <div className="admin-list">
      <div className="admin-list-filters">
        <div className="admin-list-filter-row">
          <div className="admin-list-search">
            <label htmlFor={`${selectAllId}-q`} className="sr-only">{search.label}</label>
            <span className="i-material-symbols-search-rounded admin-list-search-icon" aria-hidden="true" />
            <input
              id={`${selectAllId}-q`}
              type="search"
              value={filters[search.name] ?? ""}
              maxLength={200}
              placeholder={search.placeholder}
              autoComplete="off"
              enterKeyHint="search"
              onChange={(event) => commit({ [search.name]: event.target.value }, true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit({ [search.name]: event.currentTarget.value });
                }
              }}
            />
          </div>
          {chips ? (
            <div role="group" aria-label={chips.label} className="flex flex-wrap gap-2">
              {chips.options.map((option) => {
                const pressed = (filters[chips.name] ?? "") === option.value;
                return (
                  <button
                    key={option.value || "all"}
                    type="button"
                    className="admin-chip"
                    aria-pressed={pressed}
                    onClick={() => commit({ [chips.name]: option.value })}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {selects.map((select) => (
            <div key={select.name} className="admin-list-field">
              <label htmlFor={`${selectAllId}-${select.name}`}>{select.label}</label>
              <select
                id={`${selectAllId}-${select.name}`}
                value={filters[select.name] ?? select.value}
                onChange={(event) => commit({ [select.name]: event.target.value })}
              >
                {select.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <p className="text-sm text-fg-secondary">输入即筛选，无需点「应用」</p>
      </div>

      {notice ? <p role={notice.tone === "error" ? "alert" : "status"} className={`mb-3 text-sm ${notice.tone === "error" ? "text-[var(--danger)]" : "text-fg-secondary"}`}>{notice.text}</p> : null}

      {selected.size > 0 ? (
        <div className="admin-bulk-bar" role="region" aria-label="批量操作">
          <p className="text-sm font-medium text-fg" aria-live="polite">
            已选 <span className="font-mono">{selected.size}</span> {noun}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {(wired ? liveActions(wired) : actions).map((action) => wired ? (
              <button
                key={action.id}
                type="button"
                className={action.destructive ? "admin-danger" : ""}
                aria-label={action.id === "watched" ? "标为已看" : action.id === "want" ? "标为想看" : undefined}
                disabled={pendingAction !== null}
                onClick={() => void runWired(action.id)}
              >
                <span className={`${action.icon} size-5`} aria-hidden="true" />
                {pendingAction === action.id ? "正在处理…" : action.label}
              </button>
            ) : <ComingSoon key={action.id} action={action} />)}
          </div>
          <button type="button" className="ml-auto" onClick={() => setSelected(new Set())} disabled={pendingAction !== null}>取消选择</button>
        </div>
      ) : null}

      <div className="surface-panel overflow-hidden rounded-2xl">
        {rows.length > 0 ? (
          <>
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-1 sm:px-2">
              <label className="admin-check" htmlFor={selectAllId}>
                <input
                  ref={selectAllRef}
                  id={selectAllId}
                  type="checkbox"
                  checked={selected.size === rows.length}
                  onChange={togglePage}
                />
                <span className="admin-select-all-label">全选本页</span>
              </label>
              <div className="admin-list-head" aria-hidden="true">
                <span className="admin-list-thumb-spacer" />
                <span className="min-w-0 flex-1">标题</span>
                {columns.map((column) => (
                  <span key={column.key} className={column.className}>{column.label}</span>
                ))}
                {showStatus ? <span className="admin-list-status-col">状态</span> : null}
              </div>
              {hasTrailing ? <span className="hidden w-10 shrink-0 sm:block" aria-hidden="true" /> : null}
            </div>
            <ul aria-label={listLabel}>
              {rows.map((row) => {
                const isSelected = selected.has(row.id);
                return (
                  <li key={row.id} className="admin-list-row" data-selected={isSelected ? "true" : "false"}>
                    <label className="admin-check">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        aria-label={`选择 ${row.title}`}
                        onChange={() => toggle(row.id)}
                      />
                    </label>
                    <Link href={row.href} className="admin-list-main">
                      <ListThumb src={row.imageUrl} title={row.title} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium text-fg">{row.title}</span>
                        {row.subtitle ? <span className="mt-0.5 block break-words text-sm text-fg-secondary">{row.subtitle}</span> : null}
                        {row.detail ? <span className="mt-0.5 block break-words text-sm text-fg-secondary sm:hidden">{row.detail}</span> : null}
                        {row.meta ? <span className="mt-0.5 block break-words text-sm text-fg-secondary">{row.meta}</span> : null}
                      </span>
                      {row.cells.length > 0 ? (
                        <span className="admin-list-cells">
                          {row.cells.map((cell) => (
                            <span key={cell.key} className={`text-sm text-fg-secondary ${columnClass.get(cell.key) ?? ""}`}>
                              <span className="sr-only">{cell.label} </span>
                              {cell.value}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {row.status ? <span className="admin-list-status-col"><StatusChip status={row.status} /></span> : null}
                    </Link>
                    {row.trailing ? (
                      <Link href={row.trailing.href} aria-label={row.trailing.label} className="admin-button admin-list-trailing !min-h-10 !w-10 !px-0">
                        <span className={`${row.trailing.icon} size-5`} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="px-6 py-16 text-center text-sm text-fg-secondary">{empty}</p>
        )}
        {total > 0 ? (
          <ManagePagination
            page={page}
            totalPages={totalPages}
            params={pageParams}
            basePath={basePath}
            label={`${listLabel}分页`}
            total={total}
            pageSize={pageSize}
          />
        ) : null}
      </div>
    </div>
  );
}

function liveActions(kind: "movie" | "tv_show" | "people"): AdminBulkAction[] {
  const remove: AdminBulkAction = { id: "delete", label: "删除", icon: "i-material-symbols-delete-outline-rounded", destructive: true };
  if (kind === "people") return [remove];
  return [
    { id: "watched", label: "已看", icon: "i-material-symbols-check-circle-outline-rounded" },
    { id: "want", label: "想看", icon: "i-material-symbols-bookmark-outline-rounded" },
    remove,
  ];
}

function deleteConfirm(kind: "movie" | "tv_show" | "people", count: number, noun: string) {
  if (kind === "tv_show") return `确定删除所选 ${count} ${noun}电视节目？下属季、集和观看记录会一并删除。此操作无法撤销。`;
  if (kind === "people") return `确定删除所选 ${count} ${noun}人物？演职关联会删除，影视作品会保留。此操作无法撤销。`;
  return `确定删除所选 ${count} ${noun}电影？观看记录和关联会一并删除。此操作无法撤销。`;
}

function bulkNotice(actionId: string, result: BulkCounts, noun: string) {
  const verb = actionId === "delete" ? "删除" : actionId === "want" ? "标为想看" : "标为已看";
  if (result.succeeded > 0 && result.failed === 0) return `已${verb} ${result.succeeded} ${noun}。`;
  if (result.succeeded === 0) return `未能${verb}。${result.failed} ${noun}失败。`;
  return `已${verb} ${result.succeeded} ${noun}，${result.failed} ${noun}失败。`;
}

async function runBulk(kind: "movie" | "tv_show" | "people", actionId: string, ids: string[]) {
  if (kind === "people") return deletePeople(ids);
  if (kind === "tv_show") {
    if (actionId === "watched") return setTvShowStatus(ids, "watched");
    if (actionId === "want") return setTvShowStatus(ids, "want_to_watch");
    return deleteTvShows(ids);
  }
  if (actionId === "watched") return setMovieStatus(ids, "watched");
  if (actionId === "want") return setMovieStatus(ids, "want_to_watch");
  return deleteMovies(ids);
}

function sameLocation(target: URL, current: URL, pathname: string) {
  if (target.pathname !== (pathname || current.pathname)) return false;
  const keys = new Set([...target.searchParams.keys(), ...current.searchParams.keys()]);
  for (const key of keys) if (target.searchParams.get(key) !== current.searchParams.get(key)) return false;
  return true;
}

function readFilters(search: AdminListSearch, chips: AdminListChips | null, selects: AdminListSelect[]) {
  return {
    [search.name]: search.value,
    ...(chips ? { [chips.name]: chips.value } : {}),
    ...Object.fromEntries(selects.map((select) => [select.name, select.value])),
  };
}
