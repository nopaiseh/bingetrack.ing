import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMedia, manualRevalidateCache, saveMedia } from "@/app/(admin)/manage/actions";
import { deleteReference, saveReference } from "@/app/(admin)/manage/reference-actions";
import { deleteUnused, mergePeople } from "@/app/(admin)/manage/report-actions";
import { requireOwner } from "@/lib/auth/server";
import { reportHandledError } from "@/lib/report-error";
import { SaveMusicMediaError, deleteMusicTree, saveMusicMedia } from "@/lib/admin/save-music-media";
import { SaveBookMediaError, saveBookMedia } from "@/lib/admin/save-book-media";
import { revalidateAllMedia } from "@/lib/admin/revalidate-media";

vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>();
  return { ...actual, reportHandledError: vi.fn() };
});
vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/revalidate-media", () => ({
  affectedMediaIds: vi.fn(async (_db: unknown, ids: string[]) => ids),
  mergeAffected: (...groups: (string[] | null)[]) => groups.flatMap((group) => group ?? []),
  referenceMediaIds: vi.fn(async () => []),
  revalidateMediaItems: vi.fn(),
  revalidateAllMedia: vi.fn(),
}));
vi.mock("@/lib/admin/save-music-media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/save-music-media")>();
  return { ...actual, saveMusicMedia: vi.fn(), deleteMusicTree: vi.fn() };
});
vi.mock("@/lib/admin/save-book-media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/save-book-media")>();
  return { ...actual, saveBookMedia: vi.fn() };
});

const mediaId = "44444444-4444-4444-8444-444444444444";
const personId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const season = "22222222-2222-4222-8222-222222222222";

const rpc = vi.fn();
const target = vi.fn();
const selectCount = vi.fn();
const chain = {
  delete: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  single: vi.fn(),
};
const from = vi.fn();

function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

function episodeForm(extra: Record<string, string> = {}) {
  return form({
    id: "",
    type: "tv_episode",
    title: "第 8 集",
    parent_id: season,
    number: "8",
    status: "want_to_watch",
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: mediaId, error: null });
  target.mockResolvedValue({ data: { type: "movie" }, error: null });
  selectCount.mockResolvedValue({ count: 3, error: null });
  for (const method of Object.values(chain)) method.mockReturnValue(chain);
  chain.single.mockResolvedValue({ data: { id: personId }, error: null });
  chain.select.mockReturnValue(chain);
  from.mockImplementation((table: string) => {
    if (table === "media_items") return { select: () => ({ eq: () => ({ maybeSingle: target }) }) };
    if (table.startsWith("v_report_")) return { select: selectCount };
    return chain;
  });
  vi.mocked(requireOwner).mockResolvedValue({
    db: { rpc, from },
    user: {},
  } as unknown as Awaited<ReturnType<typeof requireOwner>>);
});

describe("manage 写入动作 Sentry 上报", () => {
  it("saveMedia：数据库错误上报，表单校验不上报", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await saveMedia({}, episodeForm({ after: "continue" }));
    expect(reportHandledError).toHaveBeenCalledWith(
      "manage saveMedia failed for media new:",
      expect.objectContaining({ code: "XX000" }),
    );

    vi.mocked(reportHandledError).mockClear();
    const bad = await saveMedia({}, form({ type: "movie", title: "" }));
    expect(bad.error).toBeTruthy();
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("saveMedia：确认类 22023 与无码应用校验不上报，带库错误码的 Save* 上报", async () => {
    vi.mocked(saveMusicMedia).mockRejectedValueOnce(new SaveMusicMediaError("标题不匹配", "22023"));
    await saveMedia({}, form({ type: "album", title: "测试专辑", release_date: "2024-01-01", after: "continue" }));
    expect(reportHandledError).not.toHaveBeenCalled();

    vi.mocked(saveMusicMedia).mockRejectedValueOnce(new SaveMusicMediaError("只支持专辑与曲目。"));
    await saveMedia({}, form({ type: "album", title: "测试专辑", release_date: "2024-01-01", after: "continue" }));
    expect(reportHandledError).not.toHaveBeenCalled();

    vi.mocked(saveBookMedia).mockRejectedValueOnce(new SaveBookMediaError("已存在同名同作者的图书。", "23505"));
    await saveMedia({}, form({ type: "book", title: "测试图书", status: "want_to_watch", after: "continue" }));
    expect(reportHandledError).toHaveBeenCalledWith(
      "manage saveMedia failed for media new:",
      expect.any(SaveBookMediaError),
    );
  });

  it("deleteMedia：标题不符不上报，未知数据库错误上报且不含确认标题", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "title mismatch" } });
    await deleteMedia({}, form({ id: mediaId, confirm_title: "机密标题勿上报" }));
    expect(reportHandledError).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "disk full" } });
    await deleteMedia({}, form({ id: mediaId, confirm_title: "机密标题勿上报" }));
    expect(reportHandledError).toHaveBeenCalledWith(
      `manage deleteMedia failed for media ${mediaId}:`,
      expect.objectContaining({ code: "XX000" }),
    );
    expect(JSON.stringify(vi.mocked(reportHandledError).mock.calls)).not.toContain("机密标题勿上报");
  });

  it("deleteMedia：专辑确认标题不符（22023）不上报", async () => {
    target.mockResolvedValue({ data: { type: "album" }, error: null });
    vi.mocked(deleteMusicTree).mockRejectedValueOnce(new SaveMusicMediaError("标题不匹配", "22023"));
    await deleteMedia({}, form({ id: mediaId, confirm_title: "错标题" }));
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("manualRevalidateCache：未知错误上报", async () => {
    vi.mocked(revalidateAllMedia).mockImplementationOnce(() => {
      throw new Error("tag failed");
    });
    await manualRevalidateCache();
    expect(reportHandledError).toHaveBeenCalledWith("manage manualRevalidateCache failed:", expect.any(Error));
  });

  it("saveReference / deleteReference：库错误上报，名称确认不符不上报", async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: "23505" } });
    await saveReference({}, form({ kind: "genres", name: "剧情" }));
    expect(reportHandledError).toHaveBeenCalledWith(
      "manage saveReference failed for genres new:",
      expect.objectContaining({ code: "23505" }),
    );

    vi.mocked(reportHandledError).mockClear();
    chain.select.mockResolvedValue({ data: [], error: null });
    await deleteReference({}, form({ kind: "people", id: personId, confirm_name: "Jane" }));
    expect(reportHandledError).not.toHaveBeenCalled();

    chain.select.mockResolvedValue({ data: null, error: { code: "23503" } });
    await deleteReference({}, form({ kind: "people", id: personId, confirm_name: "Jane" }));
    expect(reportHandledError).toHaveBeenCalledWith(
      `manage deleteReference failed for people ${personId}:`,
      expect.objectContaining({ code: "23503" }),
    );
  });

  it("deleteUnused / mergePeople：确认数量不符不上报，库错误上报", async () => {
    await deleteUnused({}, form({ report: "orphan-people", confirm_count: "2" }));
    expect(reportHandledError).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    await deleteUnused({}, form({ report: "orphan-people", confirm_count: "3" }));
    expect(reportHandledError).toHaveBeenCalledWith(
      "manage deleteUnused failed for report orphan-people:",
      expect.objectContaining({ code: "XX000" }),
    );

    vi.mocked(reportHandledError).mockClear();
    rpc.mockResolvedValue({ data: null, error: { code: "23503" } });
    const mergeForm = new FormData();
    mergeForm.set("keep", personId);
    mergeForm.append("remove", otherId);
    await mergePeople({}, mergeForm);
    expect(reportHandledError).toHaveBeenCalledWith(
      `manage mergePeople failed for keep ${personId}:`,
      expect.objectContaining({ code: "23503" }),
    );
  });
});
