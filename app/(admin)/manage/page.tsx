import Link from "next/link";
import { requireOwner } from "@/lib/auth/server";
import { mediaTypes, type ManagedMediaType } from "@/lib/admin/media-form";
import { titleOrAliasFilter } from "@/lib/admin/catalog";
import { isMediaId } from "@/lib/functions/media-id";
import StatusModal from "./StatusModal";
import { redirect } from "next/navigation";
import { formatRuntime } from "@/lib/format-runtime";
import { formatCount } from "./media/series/shared";
import Overview from "./Overview";
import { statusLabels } from "./media/series/shared";
import PageHeader, { AdminCrumb } from "../PageHeader";
import AdminList from "./list/AdminList";
import { ADMIN_LIST_PAGE_SIZE, mediaBulkActions, type AdminListRow } from "./list/model";

const PAGE_SIZE = ADMIN_LIST_PAGE_SIZE;
const sorts = { date: "上映日期（新→旧）", title: "标题", rating: "评分（高→低）" } as const;

/** 只把表、视图或新列缺失（迁移尚未应用）识别为可降级的错误，权限与网络错误照常抛出。 */
function isMissingRelation(error: { code?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01" || error?.code === "42703";
}

/** 分页搜索全部影视，或查看指定电视节目／季的下属条目；可按观看状态筛选，默认按上映日期或最近一集播出日期倒序排列。 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db } = await requireOwner();
  const params = await searchParams;
  // 不带类型的 /manage 是登录后的管理首页；各列表地址都带 type。
  if (!params.type) return <Overview db={db} />;
  const q = (params.q ?? "").slice(0, 200);
  const type = params.type && Object.hasOwn(mediaTypes, params.type) ? params.type as ManagedMediaType : "movie";
  const parent = isMediaId(params.parent) ? params.parent : "";
  const status = params.status && Object.hasOwn(statusLabels, params.status) ? params.status : "";
  // 季没有评分，不提供按评分排序。
  const sort = params.sort && Object.hasOwn(sorts, params.sort) && !(params.sort === "rating" && type === "tv_season") ? params.sort : "date";
  const page = Math.min(100000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const relation = parent && (type === "tv_season" || type === "tv_episode");
  const fields = `id,title,alternate_title,type,cover_url,release_date,runtime,tracking(status,rating),tv_seasons!tv_seasons_id_fkey${parent && type === "tv_season" ? "!inner" : ""}(series_id,season_number,parent:media_items!tv_seasons_series_id_fkey(title),episodes:tv_episodes!tv_episodes_season_id_fkey(count)),tv_episodes!tv_episodes_id_fkey${parent && type === "tv_episode" ? "!inner" : ""}(season_id,episode_number,parent:tv_seasons!tv_episodes_season_id_fkey(media_items!tv_seasons_id_fkey(title),series:media_items!tv_seasons_series_id_fkey(title))),seasons:tv_seasons!tv_seasons_series_id_fkey(season_number,episodes:tv_episodes!tv_episodes_season_id_fkey(count))`;
  const detailFields = fields.replaceAll("!inner", "");
  const offset = (page - 1) * PAGE_SIZE;

  // 优先读取排序视图：电影、单集按上映日期倒序，电视节目、季按最近一集播出日期倒序；同日期内按季号／集号倒序。
  let orderQuery = db.from("v_manage_media_order").select("id, status, rating, sort_date", { count: "exact" }).eq("type", type);
  if (q) orderQuery = orderQuery.or(titleOrAliasFilter(q));
  if (relation) orderQuery = orderQuery.eq("parent_id", parent);
  if (status) orderQuery = orderQuery.eq("status", status);
  if (sort === "title") orderQuery = orderQuery.order("title");
  if (sort === "rating") orderQuery = orderQuery.order("rating", { ascending: false, nullsFirst: false });
  const ordered = await orderQuery
    .order("sort_date", { ascending: false, nullsFirst: false })
    .order("item_number", { ascending: false, nullsFirst: false })
    .order("title")
    .order("id")
    .range(offset, offset + PAGE_SIZE - 1);

  let data: unknown[];
  let count: number;
  // 电视节目与季的状态、评分由下属单集汇总；排序视图已算好，降级路径才需另行查询。
  const derivedStatusMap = new Map<string, { status: string; rating: number | null }>();
  // 电视节目与季的日期取最近一集的播出日期，与排序口径一致。
  const latestAired = new Map<string, string>();
  if (!ordered.error) {
    const orderedRows = (ordered.data ?? []) as unknown as { id: string; status: string | null; rating: number | string | null; sort_date: string | null }[];
    for (const row of orderedRows) {
      derivedStatusMap.set(row.id, { status: row.status ?? "want_to_watch", rating: row.rating != null ? Number(row.rating) : null });
      if (row.sort_date) latestAired.set(row.id, row.sort_date);
    }
    const ids = orderedRows.map((row) => row.id);
    count = ordered.count ?? 0;
    if (ids.length > 0) {
      const details = await db.from("media_items").select(detailFields).in("id", ids);
      if (details.error) throw new Error("无法读取管理列表，请稍后重试。");
      const position = new Map(ids.map((id, index) => [id, index]));
      const detailRows = (details.data ?? []) as unknown as { id: string }[];
      data = [...detailRows].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
    } else {
      data = [];
    }
  } else if (isMissingRelation(ordered.error)) {
    // 排序视图迁移尚未应用时，退回按条目自身上映日期倒序，保证管理页仍可使用；此时状态筛选与排序选项不生效。
    let query = db.from("media_items").select(fields, { count: "exact" }).eq("type", type);
    if (q) query = query.or(titleOrAliasFilter(q));
    if (relation) query = query.eq(type === "tv_season" ? "tv_seasons.series_id" : "tv_episodes.season_id", parent);
    const fallback = await query.order("release_date", { ascending: false, nullsFirst: false }).order("title").order("id").range(offset, offset + PAGE_SIZE - 1);
    if (fallback.error) throw new Error("无法读取管理列表，请稍后重试。");
    data = fallback.data ?? [];
    count = fallback.count ?? 0;
  } else {
    throw new Error("无法读取管理列表，请稍后重试。");
  }

  // 电视节目与季的状态由单集汇总，才有「在看」，日期也取最近播出。
  const aggregated = type === "tv_show" || type === "tv_season";
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const filters = { q, type, parent, status, sort };
  if (page > totalPages) redirect(`/manage?${new URLSearchParams({ ...filters, page: String(totalPages) })}`);
  const rows = data as unknown as { id: string; title: string; alternate_title: string | null; type: ManagedMediaType; cover_url: string | null; release_date: string | null; runtime: number | string | null; tv_seasons: { season_number: number; episodes?: { count: number }[]; parent?: { title: string } | null } | null; tv_episodes: { episode_number: number; parent?: { media_items?: { title: string } | null; series?: { title: string } | null } | null } | null; seasons?: { season_number: number; episodes?: { count: number }[] }[]; tracking: { status: string; rating: number | null } | { status: string; rating: number | null }[] | null }[];
  if (ordered.error && rows.length > 0) {
    const ids = rows.map(r => r.id);
    if (type === "tv_show") {
      const { data: statusList } = await db
        .from("v_all_media")
        .select("id, status, rating")
        .in("id", ids);
      if (statusList) {
        for (const item of statusList) {
          derivedStatusMap.set(item.id, {
            status: item.status ?? "want_to_watch",
            rating: item.rating != null ? Number(item.rating) : null,
          });
        }
      }
    } else if (type === "tv_season") {
      const { data: summaryList } = await db
        .from("v_media_season_summaries")
        .select("id, episode_count, watched_episode_count")
        .in("id", ids);
      if (summaryList) {
        for (const item of summaryList) {
          const episodeCount = Number(item.episode_count ?? 0);
          const watchedCount = Number(item.watched_episode_count ?? 0);
          const status = episodeCount > 0 && watchedCount === episodeCount
            ? "watched"
            : watchedCount > 0
              ? "watching"
              : "want_to_watch";
          derivedStatusMap.set(item.id, { status, rating: null });
        }
      }
    }
  }

  const columns = [
    { key: "date", label: aggregated ? "最近播出" : "上映", className: "admin-col-date" },
    ...(type === "movie" ? [{ key: "runtime", label: "片长", className: "admin-col-runtime" }] : []),
    ...(type === "tv_show" ? [{ key: "structure", label: "季 / 集", className: "admin-col-structure" }] : []),
    ...(type === "tv_season" ? [] : [{ key: "rating", label: "评分", className: "admin-col-rating" }]),
  ];
  const listRows: AdminListRow[] = rows.map(/* 兼容 PostgREST 根据唯一外键返回的单对象关系。 */ item => {
    const tracking = Array.isArray(item.tracking) ? item.tracking[0] : item.tracking;
    let itemStatus = tracking?.status ?? "want_to_watch";
    let rating = tracking?.rating != null ? Number(tracking.rating) : null;
    if (item.type === "tv_show") {
      const derived = derivedStatusMap.get(item.id);
      itemStatus = derived?.status ?? "want_to_watch";
      rating = derived?.rating ?? null;
    } else if (item.type === "tv_season") {
      const derived = derivedStatusMap.get(item.id);
      itemStatus = derived?.status ?? "want_to_watch";
      rating = null;
    }
    const statusLabel = statusLabels[itemStatus as keyof typeof statusLabels] ?? statusLabels.want_to_watch;
    const seasonList = item.seasons ?? [];
    const episodeTotal = seasonList.reduce((sum, season) => sum + (season.episodes?.[0]?.count ?? 0), 0);
    const nextSeason = Math.max(0, ...seasonList.map(season => season.season_number)) + 1;
    const date = aggregated ? latestAired.get(item.id) : item.release_date;
    const context = item.tv_seasons ? `${item.tv_seasons.parent?.title ?? "未知电视节目"} · 第 ${item.tv_seasons.season_number} 季 · ${formatCount(item.tv_seasons.episodes?.[0]?.count ?? 0)} 集`
      : item.tv_episodes ? `${item.tv_episodes.parent?.series?.title ?? ""} · ${item.tv_episodes.parent?.media_items?.title ?? "未知季"} · 第 ${formatCount(item.tv_episodes.episode_number)} 集` : null;
    const minutes = item.runtime == null ? null : Number(item.runtime);
    const runtime = formatRuntime(minutes);
    const cells = [
      { key: "date", label: aggregated ? "最近播出" : "上映", value: date ?? "—" },
      ...(item.type === "movie" ? [{ key: "runtime", label: "片长", value: runtime ?? "—" }] : []),
      ...(item.type === "tv_show" ? [{ key: "structure", label: "季 / 集", value: `${formatCount(seasonList.length)} 季 · ${formatCount(episodeTotal)} 集` }] : []),
      ...(item.type === "tv_season" ? [] : [{ key: "rating", label: "评分", value: rating != null ? rating.toFixed(1) : "—" }]),
    ];
    const tone: "watched" | "watching" | "want" = itemStatus === "watched" ? "watched" : itemStatus === "watching" ? "watching" : "want";
    return {
      id: item.id,
      href: `/manage/media/${item.id}?type=${item.type}`,
      title: item.title,
      subtitle: item.alternate_title,
      detail: (item.type === "movie"
        ? [date, minutes ? `${Math.round(minutes)} 分钟` : null]
        : item.type === "tv_show"
          ? [date, `${formatCount(seasonList.length)} 季 · ${formatCount(episodeTotal)} 集`]
          : cells.map(cell => cell.value).filter(value => value !== "—")).filter(Boolean).join(" · "),
      meta: context,
      imageUrl: item.cover_url,
      cells,
      status: { label: statusLabel, tone },
      trailing: item.type === "tv_show"
        ? { href: `/manage/media/${item.id}?type=tv_show&add=season`, label: `为${item.title}新增第 ${formatCount(nextSeason)} 季`, icon: "i-material-symbols-add-rounded" }
        : item.type === "movie"
          ? { href: `/movies/${item.id}`, label: `查看${item.title}的公开页面`, icon: "i-material-symbols-arrow-outward-rounded" }
          : null,
    };
  });
  const noun = type === "tv_episode" ? "集" : type === "tv_season" ? "季" : "部";

  return <section>
    <PageHeader
      eyebrow={<AdminCrumb current={mediaTypes[type]} />}
      title={mediaTypes[type]}
      description={<>共 {count} 个条目 · 管理影视与观看记录</>}
      actions={<Link href={`/manage/media/new${type ? `?type=${type}${parent ? `&parent=${parent}` : ""}` : ""}`} className="admin-button admin-primary shrink-0">新增{type ? mediaTypes[type] : "媒体"}</Link>}
    />
    {params.deleted === "1" && <StatusModal key={params.n} message="条目及其下属资料已删除。" />}
    {parent && (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-neutral-200">
          <span className="i-material-symbols-filter-alt-rounded size-4.5 text-[var(--accent)] shrink-0" aria-hidden="true" />
          <span>当前仅显示所选条目的下属{mediaTypes[type]}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/manage/media/${parent}`} className="text-sm text-neutral-300 underline hover:text-white transition-colors">
            返回上级条目
          </Link>
          <Link href={`/manage?type=${type}`} className="admin-button !min-h-10 !py-1 !px-3 text-sm">
            查看全部{mediaTypes[type]}
          </Link>
        </div>
      </div>
    )}
    <AdminList
      basePath="/manage"
      preserved={{ type, ...(parent ? { parent } : {}) }}
      defaults={{ sort: "date" }}
      search={{ name: "q", label: "搜索标题", placeholder: "搜索标题或原名", value: q }}
      chips={{
        name: "status",
        label: "观看状态",
        value: status,
        options: [{ value: "", label: "全部" }, ...Object.entries(statusLabels).filter(([value]) => !(value === "watching" && !aggregated)).map(([value, label]) => ({ value, label }))],
      }}
      selects={[{
        name: "sort",
        label: "排序",
        value: sort,
        options: Object.entries(sorts).filter(([value]) => !(value === "rating" && type === "tv_season")).map(([value, label]) => ({ value, label: value === "date" && aggregated ? "最近播出（新→旧）" : label })),
      }]}
      columns={columns}
      rows={listRows}
      page={page}
      pageSize={PAGE_SIZE}
      total={count}
      totalPages={totalPages}
      pageParams={filters}
      empty="没有符合条件的条目。"
      noun={noun}
      listLabel={`${mediaTypes[type]}列表`}
      actions={mediaBulkActions}
      showStatus
    />
  </section>;
}
