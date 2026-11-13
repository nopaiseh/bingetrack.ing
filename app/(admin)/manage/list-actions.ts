"use server";

import { requireOwner } from "@/lib/auth/server";
import {
  bulkDeleteMovies,
  bulkDeletePeople,
  bulkDeleteTvShows,
  bulkSetMovieStatus,
  bulkSetTvShowStatus,
  listAdminMedia,
  listAdminPeople,
} from "@/lib/admin/lists";
import type { AdminListInput, BulkStatus } from "@/lib/admin/list-params";

/** 分页搜索人物。先确认站长身份，再按白名单排序。参数和返回值见 lib/admin/list-params.ts。 */
export async function listPeople(input: AdminListInput = {}) {
  const { db } = await requireOwner();
  return listAdminPeople(db, input);
}

/** 分页搜索电影。 */
export async function listMovies(input: AdminListInput = {}) {
  const { db } = await requireOwner();
  return listAdminMedia(db, "movie", input);
}

/** 分页搜索电视节目。 */
export async function listTvShows(input: AdminListInput = {}) {
  const { db } = await requireOwner();
  return listAdminMedia(db, "tv_show", input);
}

/** 批量删除人物。返回去重后的成功与失败条数。 */
export async function deletePeople(ids: string[]) {
  const { db } = await requireOwner();
  return bulkDeletePeople(db, ids);
}

/** 批量删除电影。 */
export async function deleteMovies(ids: string[]) {
  const { db } = await requireOwner();
  return bulkDeleteMovies(db, ids);
}

/** 批量删除电视节目及其季、集。 */
export async function deleteTvShows(ids: string[]) {
  const { db } = await requireOwner();
  return bulkDeleteTvShows(db, ids);
}

/** 批量修改电影观看状态，不改评分。 */
export async function setMovieStatus(ids: string[], status: BulkStatus) {
  const { db } = await requireOwner();
  return bulkSetMovieStatus(db, ids, status);
}

/** 批量修改电视节目观看状态：写入全部单集的 tracking，不改评分。 */
export async function setTvShowStatus(ids: string[], status: BulkStatus) {
  const { db } = await requireOwner();
  return bulkSetTvShowStatus(db, ids, status);
}
