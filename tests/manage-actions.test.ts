import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveReference, deleteReference, searchChoices, saveCollectionMember } from "@/app/manage/reference-actions";
import { requireOwner } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
const chain = { delete: vi.fn(), eq: vi.fn(), select: vi.fn(), update: vi.fn(), insert: vi.fn(), single: vi.fn(), ilike: vi.fn(), order: vi.fn(), limit: vi.fn(), in: vi.fn(), then: vi.fn((resolve: (val: unknown) => void) => resolve({ data: [], error: null })) };
const from = vi.fn(() => chain);
/** 用链式替身检查动作的白名单和确认条件；真实 RLS 与级联由数据库测试验证。 */
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockResolvedValue({ db: { from }, user: {} } as unknown as Awaited<ReturnType<typeof requireOwner>>);
  for (const [key, method] of Object.entries(chain)) {
    if (key !== "then") method.mockReturnValue(chain);
  }
  chain.then.mockImplementation((resolve: (val: unknown) => void) => resolve({ data: [], error: null }));
});
function form(values: Record<string, string>) { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; }
describe("关联资料服务端操作", () => {
  it("每个入口先检查站长身份", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("unauthorized"));
    for (const request of [() => saveReference({}, new FormData()), () => deleteReference({}, new FormData()), () => searchChoices("people", ""), () => saveCollectionMember({}, new FormData())]) {
      await expect(request()).rejects.toThrow("unauthorized");
    }
    expect(from).not.toHaveBeenCalled();
  });
  it("拒绝任意表名，不能访问站长配置表", async () => {
    expect(await saveReference({}, form({ kind: "site_owner", name: "x" }))).toHaveProperty("error");
    expect(await deleteReference({}, form({ kind: "site_owner", id, confirm_name: "x" }))).toHaveProperty("error");
    expect(from).not.toHaveBeenCalled();
  });
  it("删除同时匹配 ID 和完整名称，未命中时不刷新缓存", async () => {
    chain.select.mockResolvedValue({ data: [], error: null });
    const result = await deleteReference({}, form({ kind: "people", id, confirm_name: "Jane" }));
    expect(chain.eq).toHaveBeenCalledWith("id", id);
    expect(chain.eq).toHaveBeenCalledWith("name", "Jane");
    expect(result.error).toContain("名称不匹配");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("仍有外键引用时提供可操作错误", async () => {
    chain.select.mockResolvedValue({ data: null, error: { code: "23503" } });
    expect((await deleteReference({}, form({ kind: "people", id, confirm_name: "Jane" }))).error).toContain("先移除");
  });
  it("重复名称不会报告保存成功", async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: "23505" } });
    expect((await saveReference({}, form({ kind: "genres", name: "剧情" }))).error).toContain("已经存在");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("删除资料时自动去除确认名称的首尾空格", async () => {
    chain.select.mockResolvedValue({ data: [{ id }], error: null });
    await deleteReference({}, form({ kind: "people", id, confirm_name: "  Jane  " }));
    expect(chain.eq).toHaveBeenCalledWith("name", "Jane");
  });
  it("系列顺序必须是范围内整数", async () => {
    expect(await saveCollectionMember({}, form({ series_id: id, media_item_id: id, position: "1.5" }))).toHaveProperty("error");
    expect(from).not.toHaveBeenCalled();
  });
  it("移除系列成员时无需验证顺序数值", async () => {
    chain.select.mockResolvedValue({ data: [{ media_item_id: id }], error: null });
    const result = await saveCollectionMember({}, form({ series_id: id, media_item_id: id, intent: "remove" }));
    expect(result).toEqual({ saved: true });
    expect(chain.delete).toHaveBeenCalled();
  });
  it("searchChoices 容忍缺失的上级剧集资料而不崩溃", async () => {
    chain.then.mockImplementation((resolve: (val: unknown) => void) =>
      resolve({
        data: [{ id, title: "第 1 季", type: "tv_season", cover_url: null, season: { season_number: 1, parent: null } }],
        error: null,
      })
    );
    const result = await searchChoices("tv_season", "query");
    expect(result.choices[0].detail).toBe("未知剧集 · 第 1 季");
  });
});
