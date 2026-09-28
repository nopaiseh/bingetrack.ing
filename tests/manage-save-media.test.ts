import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveMedia } from "@/app/(admin)/manage/actions";
import { requireOwner } from "@/lib/auth/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const saved = "44444444-4444-4444-8444-444444444444";
const season = "22222222-2222-4222-8222-222222222222";
const rpc = vi.fn();

function episodeForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ id: "", type: "tv_episode", title: "第 8 集", parent_id: season, number: "8", status: "want_to_watch", ...extra })) form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: saved, error: null });
  vi.mocked(requireOwner).mockResolvedValue({ db: { rpc }, user: {} } as unknown as Awaited<ReturnType<typeof requireOwner>>);
});

describe("saveMedia 快速新增", () => {
  it("连续录入时留在当前页：刷新数据并返回新条目，不跳转", async () => {
    const result = await saveMedia({}, episodeForm({ after: "continue" }));
    expect(result).toEqual({ saved: true, id: saved });
    expect(refresh).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("未选择连续录入时打开新条目", async () => {
    await saveMedia({}, episodeForm({ after: "open" }));
    expect(redirect).toHaveBeenCalledWith(`/manage/media/${saved}?saved=1`);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("编号重复时返回可操作的提示，不刷新也不跳转", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    const result = await saveMedia({}, episodeForm({ after: "continue" }));
    expect(result.error).toContain("已存在这个编号");
    expect(refresh).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
