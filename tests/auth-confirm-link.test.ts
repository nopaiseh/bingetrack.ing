import { describe, expect, it } from "vitest";
import { readConfirmQuery, safeConfirmNext } from "@/lib/auth/confirm-link";

describe("一次性登录回跳", () => {
  it("只接受精确的 /manage，其余都落到设置页", () => {
    expect(safeConfirmNext("/manage")).toBe("/manage");
    expect(safeConfirmNext("/manage/")).toBe("/settings");
    expect(safeConfirmNext("/manage?next=1")).toBe("/settings");
    expect(safeConfirmNext("//evil.example")).toBe("/settings");
    expect(safeConfirmNext("https://evil.example/manage")).toBe("/settings");
    expect(safeConfirmNext("/settings")).toBe("/settings");
    expect(safeConfirmNext(null)).toBe("/settings");
  });

  it("只取第一个非空值，类型必须是 magiclink 或 invite", () => {
    expect(readConfirmQuery({
      token_hash: ["  hash  ", "other"],
      type: ["invite", "magiclink"],
      next: ["/manage", "/settings"],
    })).toEqual({ ok: true, tokenHash: "hash", type: "invite", next: "/manage" });
    expect(readConfirmQuery({ token_hash: "hash", type: "magiclink", next: "https://evil.example" })).toEqual({
      ok: true,
      tokenHash: "hash",
      type: "magiclink",
      next: "/settings",
    });
    expect(readConfirmQuery({ token_hash: " ", type: "magiclink" })).toEqual({ ok: false });
    expect(readConfirmQuery({ token_hash: "hash", type: "recovery" })).toEqual({ ok: false });
    expect(readConfirmQuery({ token_hash: "hash", type: "MAGICLINK" })).toEqual({ ok: false });
    expect(readConfirmQuery({})).toEqual({ ok: false });
  });
});
