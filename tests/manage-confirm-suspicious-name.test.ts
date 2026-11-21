import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmSuspiciousName } from "@/app/(admin)/manage/report-actions";
import { requireOwner } from "@/lib/auth/server";
import { redirect } from "next/navigation";

vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>();
  return { ...actual, reportHandledError: vi.fn() };
});
vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const peopleItem = "people:22222222-2222-4222-8222-222222222222";
const creditItem = "credit:44444444-4444-4444-8444-444444444444:22222222-2222-4222-8222-222222222222";
const deleteEq = vi.fn();
const upsert = vi.fn();
const from = vi.fn(() => ({
  delete: () => ({ eq: deleteEq }),
  upsert,
}));

function form(entries: [string, string][]) {
  const result = new FormData();
  for (const [key, value] of entries) result.append(key, value);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteEq.mockResolvedValue({ error: null });
  upsert.mockResolvedValue({ error: null });
  vi.mocked(requireOwner).mockResolvedValue({ db: { from }, user: {} } as unknown as Awaited<
    ReturnType<typeof requireOwner>
  >);
});

describe("确认疑似名字错误", () => {
  it("先删后 upsert，再回到报告页", async () => {
    await confirmSuspiciousName(
      {},
      form([
        ["item_id", peopleItem.toUpperCase()],
        ["confirmed_name", "Report  Actor"],
      ]),
    );
    expect(from).toHaveBeenCalledWith("name_issue_confirmations");
    expect(deleteEq).toHaveBeenCalledWith("item_id", peopleItem);
    expect(upsert).toHaveBeenCalledWith(
      { item_id: peopleItem, confirmed_name: "Report  Actor" },
      { onConflict: "item_id", ignoreDuplicates: true },
    );
    expect(redirect).toHaveBeenCalledWith(
      expect.stringMatching(/^\/manage\/reports\/suspicious-names\?confirmed=1&n=\d+$/),
    );
  });

  it("接受 credit 行 id", async () => {
    await confirmSuspiciousName(
      {},
      form([
        ["item_id", creditItem],
        ["confirmed_name", "英雄/反派"],
      ]),
    );
    expect(upsert).toHaveBeenCalledWith(
      { item_id: creditItem, confirmed_name: "英雄/反派" },
      { onConflict: "item_id", ignoreDuplicates: true },
    );
  });

  it("拒绝格式不正确的条目", async () => {
    expect(
      await confirmSuspiciousName(
        {},
        form([
          ["item_id", "people:not-a-uuid"],
          ["confirmed_name", "Name"],
        ]),
      ),
    ).toHaveProperty("error");
    expect(await confirmSuspiciousName({}, form([["item_id", peopleItem]]))).toHaveProperty("error");
    expect(from).not.toHaveBeenCalled();
  });

  it("写入失败时说明原因，不跳转", async () => {
    upsert.mockResolvedValue({ error: { code: "42501" } });
    expect(
      (
        await confirmSuspiciousName(
          {},
          form([
            ["item_id", peopleItem],
            ["confirmed_name", "Name"],
          ]),
        )
      ).error,
    ).toContain("确认失败");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("先检查站长身份", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("unauthorized"));
    await expect(
      confirmSuspiciousName(
        {},
        form([
          ["item_id", peopleItem],
          ["confirmed_name", "Name"],
        ]),
      ),
    ).rejects.toThrow("unauthorized");
  });
});
