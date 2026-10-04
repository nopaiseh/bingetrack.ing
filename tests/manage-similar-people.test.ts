import { beforeEach, describe, expect, it, vi } from "vitest";
import { dismissSimilarPeople, mergePeople } from "@/app/(admin)/manage/report-actions";
import { requireOwner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { referenceMediaIds, revalidateMediaItems } from "@/lib/admin/revalidate-media";

vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/admin/revalidate-media", () => ({ referenceMediaIds: vi.fn(async () => [movie]), revalidateMediaItems: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const keep = "22222222-2222-4222-8222-222222222222";
const other = "11111111-1111-4111-8111-111111111111";
const third = "33333333-3333-4333-8333-333333333333";
const movie = "44444444-4444-4444-8444-444444444444";
const rpc = vi.fn();
const upsert = vi.fn();
const from = vi.fn(() => ({ upsert }));

function form(entries: [string, string][]) {
  const result = new FormData();
  for (const [key, value] of entries) result.append(key, value);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: 3, error: null });
  upsert.mockResolvedValue({ error: null });
  vi.mocked(requireOwner).mockResolvedValue({ db: { rpc, from }, user: {} } as unknown as Awaited<ReturnType<typeof requireOwner>>);
});

describe("合并疑似重复人物", () => {
  it("把其余人物并入保留的人物，只刷新这些人物参与的作品后回到报告", async () => {
    await mergePeople({}, form([["keep", keep], ["remove", other], ["remove", keep], ["remove", other]]));
    expect(rpc).toHaveBeenCalledWith("manage_merge_people", { p_keep: keep, p_remove: [other] });
    // 被合并人物的演职关联会随合并删除，受影响作品必须在合并前查出。
    expect(referenceMediaIds).toHaveBeenCalledWith(expect.anything(), "people", [keep, other]);
    expect(vi.mocked(referenceMediaIds).mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
    expect(revalidateMediaItems).toHaveBeenCalledExactlyOnceWith([movie]);
    expect(redirect).toHaveBeenCalledWith(expect.stringMatching(/^\/manage\/reports\/similar-people\?merged=1&n=\d+$/));
  });

  it("拒绝格式不正确或没有可合并的人物", async () => {
    expect(await mergePeople({}, form([["keep", keep], ["remove", "x"]]))).toHaveProperty("error");
    expect(await mergePeople({}, form([["keep", keep], ["remove", keep]]))).toHaveProperty("error");
    // 保留者与待合并者只差大小写时是同一人物，也不能进入合并。
    expect(await mergePeople({}, form([["keep", keep.toUpperCase()], ["remove", keep]]))).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("仍是专辑艺术家时说明原因，不跳转", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23503" } });
    expect((await mergePeople({}, form([["keep", keep], ["remove", other]]))).error).toContain("专辑艺术家");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("先检查站长身份", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("unauthorized"));
    await expect(mergePeople({}, form([["keep", keep], ["remove", other]]))).rejects.toThrow("unauthorized");
  });
});

describe("标记不是同一人", () => {
  it("记录组内每一对，较小的 ID 在前，重复标记不报错", async () => {
    await dismissSimilarPeople({}, form([["person", keep.toUpperCase()], ["person", other], ["person", third]]));
    expect(from).toHaveBeenCalledWith("people_distinct_pairs");
    expect(upsert).toHaveBeenCalledWith([
      { person_a: other, person_b: keep },
      { person_a: keep, person_b: third },
      { person_a: other, person_b: third },
    ], { onConflict: "person_a,person_b", ignoreDuplicates: true });
    expect(redirect).toHaveBeenCalledWith(expect.stringMatching(/^\/manage\/reports\/similar-people\?dismissed=1&n=\d+$/));
  });

  it("少于两位人物时不写入", async () => {
    expect(await dismissSimilarPeople({}, form([["person", keep]]))).toHaveProperty("error");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("人数超过上限时不写入，也不合并", async () => {
    const many = Array.from({ length: 21 }, (_, index) => ["person", `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`] as [string, string]);
    expect(await dismissSimilarPeople({}, form(many))).toHaveProperty("error");
    expect(await mergePeople({}, form([["keep", keep], ...many.map(([, id]) => ["remove", id] as [string, string])]))).toHaveProperty("error");
    expect(upsert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
