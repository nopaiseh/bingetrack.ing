import Link from "next/link";
import { redirect } from "next/navigation";
import { formatRuntime } from "@/lib/format-runtime";
import {
  ADMIN_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_LIST_MAX_PAGE,
  ADMIN_LIST_MAX_PAGE_SIZE,
  ADMIN_LIST_MAX_QUERY_LENGTH,
  type MediaListItem,
} from "@/lib/admin/list-params";
import { mediaTypes } from "@/lib/admin/media-form";
import { listMovies, listPeople, listTvShows } from "../list-actions";
import { formatCount, statusLabels } from "../media/series/shared";
import PageHeader, { AdminCrumb } from "../../PageHeader";
import StatusModal from "../StatusModal";
import AdminList from "./AdminList";
import type { AdminListRow } from "./model";

const pageSizes = [25, 50, 100].map((size) => ({ value: String(size), label: String(size) }));

function readPage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, ADMIN_LIST_MAX_PAGE);
}

function readPageSize(value: string | undefined) {
  const size = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(size) || size < 1) return ADMIN_LIST_DEFAULT_PAGE_SIZE;
  return Math.min(size, ADMIN_LIST_MAX_PAGE_SIZE);
}

function pageParams(values: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(values).flatMap(([key, value]) => (value ? [[key, value]] : [])));
}

/** 电影和电视节目走分页接口。季与单集仍用原列表，因为接口不接受这两种类型。 */
export async function PagedMediaList({ type, search }: { type: "movie" | "tv_show"; search: Record<string, string | undefined> }) {
  const q = (search.q ?? "").trim().slice(0, ADMIN_LIST_MAX_QUERY_LENGTH);
  const sort = search.sort === "title" || search.sort === "rating" ? search.sort : "date";
  const page = readPage(search.page);
  const pageSize = readPageSize(search.pageSize);
  const result = type === "movie"
    ? await listMovies({ q, sort, page, pageSize })
    : await listTvShows({ q, sort, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const kept = pageParams({ type, q, sort: sort === "date" ? undefined : sort, pageSize: result.pageSize === ADMIN_LIST_DEFAULT_PAGE_SIZE ? undefined : String(result.pageSize) });
  if (page > totalPages) redirect(`/manage?${new URLSearchParams({ ...kept, page: String(totalPages) })}`);
  const show = type === "tv_show";
  return <section>
    <PageHeader
      eyebrow={<AdminCrumb current={mediaTypes[type]} />}
      title={mediaTypes[type]}
      description={<>共 {result.total} 个条目 · 管理影视与观看记录</>}
      actions={<Link href={`/manage/media/new?type=${type}`} className="admin-button admin-primary shrink-0">新增{mediaTypes[type]}</Link>}
    />
    {search.deleted === "1" && <StatusModal key={search.n} message="条目及其下属资料已删除。" />}
    <AdminList
      basePath="/manage"
      preserved={{ type }}
      defaults={{ sort: "date", pageSize: String(ADMIN_LIST_DEFAULT_PAGE_SIZE) }}
      search={{ name: "q", label: "搜索标题", placeholder: "搜索标题或原名", value: q }}
      selects={[
        { name: "sort", label: "排序", value: sort, options: [
          { value: "date", label: show ? "最近播出（新→旧）" : "上映日期（新→旧）" },
          { value: "title", label: "标题" },
          { value: "rating", label: "评分（高→低）" },
        ] },
        { name: "pageSize", label: "每页", value: String(result.pageSize), options: pageSizes },
      ]}
      columns={[
        { key: "date", label: show ? "最近播出" : "上映", className: "admin-col-date" },
        ...(show ? [{ key: "structure", label: "季 / 集", className: "admin-col-structure" }] : [{ key: "runtime", label: "片长", className: "admin-col-runtime" }]),
        { key: "rating", label: "评分", className: "admin-col-rating" },
      ]}
      rows={result.items.map(mediaRow)}
      page={result.page}
      pageSize={result.pageSize}
      total={result.total}
      totalPages={totalPages}
      pageParams={kept}
      empty="没有符合条件的条目。"
      noun="部"
      listLabel={`${mediaTypes[type]}列表`}
      actions={[]}
      wired={type}
      showStatus
    />
  </section>;
}

function mediaRow(item: MediaListItem): AdminListRow {
  const date = item.sort_date ?? item.release_date;
  const tone = item.status === "watched" ? "watched" : item.status === "watching" ? "watching" : "want";
  const runtime = formatRuntime(item.runtime);
  const structure = `${formatCount(item.season_count)} 季 · ${formatCount(item.episode_count)} 集`;
  const cells = [
    { key: "date", label: item.type === "tv_show" ? "最近播出" : "上映", value: date ?? "—" },
    ...(item.type === "movie" ? [{ key: "runtime", label: "片长", value: runtime ?? "—" }] : []),
    ...(item.type === "tv_show" ? [{ key: "structure", label: "季 / 集", value: structure }] : []),
    { key: "rating", label: "评分", value: item.rating != null ? item.rating.toFixed(1) : "—" },
  ];
  return {
    id: item.id,
    href: `/manage/media/${item.id}?type=${item.type}`,
    title: item.title,
    subtitle: item.alternate_title,
    detail: item.type === "movie"
      ? [date, item.runtime ? `${Math.round(item.runtime)} 分钟` : null].filter(Boolean).join(" · ")
      : [date, structure].filter(Boolean).join(" · "),
    imageUrl: item.cover_url,
    cells,
    status: { label: statusLabels[item.status], tone },
    trailing: item.type === "tv_show"
      ? { href: `/manage/media/${item.id}?type=tv_show&add=season`, label: `为${item.title}新增季`, icon: "i-material-symbols-add-rounded" }
      : { href: `/movies/${item.id}`, label: `查看${item.title}的公开页面`, icon: "i-material-symbols-arrow-outward-rounded" },
  };
}

/** 人物走分页接口。其他关联资料仍用原来的查询。 */
export async function PagedPeopleList({ search }: { search: { q?: string; page?: string; pageSize?: string; sort?: string; deleted?: string; n?: string } }) {
  const q = (search.q ?? "").trim().slice(0, ADMIN_LIST_MAX_QUERY_LENGTH);
  const sort = search.sort === "alternate_name" ? "alternate_name" : "name";
  const page = readPage(search.page);
  const pageSize = readPageSize(search.pageSize);
  const result = await listPeople({ q, sort, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const kept = pageParams({ q, sort: sort === "name" ? undefined : sort, pageSize: result.pageSize === ADMIN_LIST_DEFAULT_PAGE_SIZE ? undefined : String(result.pageSize) });
  if (page > totalPages) redirect(`/manage/references/people?${new URLSearchParams({ ...kept, page: String(totalPages) })}`);
  return <section>
    <PageHeader
      eyebrow={<AdminCrumb current="人物" />}
      title="人物"
      description={<>共 <span className="font-mono">{result.total.toLocaleString("en-US")}</span> 项资料 · 集中维护，关联作品同步更新</>}
      actions={<Link className="admin-button admin-primary shrink-0" href="/manage/references/people/new">新增人物</Link>}
    />
    {search.deleted && <StatusModal key={search.n} message="资料及其关联已删除，影视作品已保留。" />}
    <AdminList
      basePath="/manage/references/people"
      preserved={{}}
      defaults={{ sort: "name", pageSize: String(ADMIN_LIST_DEFAULT_PAGE_SIZE) }}
      search={{ name: "q", label: "搜索名称或别名", placeholder: "搜索人物名称或别名", value: q }}
      selects={[
        { name: "sort", label: "排序", value: sort, options: [{ value: "name", label: "姓名" }, { value: "alternate_name", label: "别名" }] },
        { name: "pageSize", label: "每页", value: String(result.pageSize), options: pageSizes },
      ]}
      columns={[{ key: "count", label: "关联", className: "admin-col-count" }]}
      rows={result.items.map((person) => {
        const countLabel = `${person.credit_count.toLocaleString("en-US")} 个关联`;
        return {
          id: person.id,
          href: `/manage/references/people/${person.id}`,
          title: person.name,
          subtitle: person.alternate_name || "未填别名",
          detail: countLabel,
          cells: [{ key: "count", label: "关联", value: countLabel }],
        };
      })}
      page={result.page}
      pageSize={result.pageSize}
      total={result.total}
      totalPages={totalPages}
      pageParams={kept}
      empty={q ? "没有匹配的资料，试试其他名称或别名。" : "还没有人物，从第一项资料开始。"}
      noun="项"
      listLabel="人物列表"
      actions={[]}
      wired="people"
    />
  </section>;
}
