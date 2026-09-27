import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUnused } from "@/app/(admin)/manage/report-actions";
import { isReportKind, reportGroups, reportRowHref, reportRowType, reportTagLabels, reports } from "@/lib/admin/reports";
import { requireOwner } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
const select = vi.fn();
const from = vi.fn(() => ({ select }));
const rpc = vi.fn();
function form(values: Record<string, string>) { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; }

describe("报告配置", () => {
  it("只接受已定义的报告", () => {
    expect(isReportKind("orphan-people")).toBe(true);
    expect(isReportKind("site_owner")).toBe(false);
    expect(isReportKind("toString")).toBe(false);
  });
  it("每份报告都在分组中出现一次", () => {
    expect(reportGroups().flatMap(group => group.kinds).sort()).toEqual(Object.keys(reports).sort());
  });
  it("媒体进入编辑页，关联资料进入详情", () => {
    expect(reportRowHref({ link_type: "tv_episode", link_id: id })).toBe(`/manage/media/${id}?type=tv_episode`);
    expect(reportRowHref({ link_type: "people", link_id: id })).toBe(`/manage/references/people/${id}`);
    expect(reportRowType("movie")).toBe("电影");
    expect(reportRowType("collections")).toBe("系列");
  });
  it("资料类别标签沿用关联资料名称", () => {
    expect(reportTagLabels.languages).toBe("语言");
    expect(reportTagLabels.no_cover).toBe("缺封面");
  });
});

/** 用替身检查批量删除的白名单与数量确认；真实删除条件由数据库测试验证。 */
describe("批量删除闲置资料", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireOwner).mockResolvedValue({ db: { from, rpc }, user: {} } as unknown as Awaited<ReturnType<typeof requireOwner>>);
    select.mockResolvedValue({ count: 3, error: null });
    rpc.mockResolvedValue({ data: 3, error: null });
  });
  it("先检查站长身份", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("unauthorized"));
    await expect(deleteUnused({}, form({ report: "orphan-people", confirm_count: "3" }))).rejects.toThrow("unauthorized");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("拒绝未知报告和不支持批量删除的报告", async () => {
    expect(await deleteUnused({}, form({ report: "site_owner", confirm_count: "3" }))).toHaveProperty("error");
    expect(await deleteUnused({}, form({ report: "missing-alias", confirm_count: "3" }))).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("确认数量与当前报告不符时不删除", async () => {
    const result = await deleteUnused({}, form({ report: "orphan-people", confirm_count: "2" }));
    expect(result.error).toContain("3");
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("数量一致时按报告类别删除并返回结果", async () => {
    await deleteUnused({}, form({ report: "unused-references", confirm_count: "3" }));
    expect(from).toHaveBeenCalledWith("v_report_unused_references");
    expect(rpc).toHaveBeenCalledWith("manage_delete_unused", { p_kind: "references" });
    expect(redirect).toHaveBeenCalledWith("/manage/reports/unused-references?deleted=3");
  });
  it("删除失败时不刷新缓存", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect((await deleteUnused({}, form({ report: "orphan-people", confirm_count: "3" }))).error).toContain("删除失败");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
