import { requireOwner } from "@/lib/auth/server";
import { mediaTypes, type ManagedMediaType } from "@/lib/admin/media-form";
import Overview from "./Overview";
import { PagedChildList, PagedMediaList } from "./list/wired";

/** 不带类型时显示管理首页。电影、电视节目、季和单集分别进入对应的分页列表。 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db } = await requireOwner();
  const params = await searchParams;
  // 不带类型的 /manage 是登录后的管理首页；各列表地址都带 type。
  if (!params.type) return <Overview db={db} />;
  const type = Object.hasOwn(mediaTypes, params.type) ? params.type as ManagedMediaType : "movie";
  if (type === "movie" || type === "tv_show") return <PagedMediaList type={type} search={params} />;
  return <PagedChildList db={db} type={type} search={params} />;
}
