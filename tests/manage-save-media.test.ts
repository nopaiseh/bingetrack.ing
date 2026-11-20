import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMedia, saveMedia } from "@/app/(admin)/manage/actions";
import { requireOwner } from "@/lib/auth/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateMediaItems } from "@/lib/admin/revalidate-media";
import { deleteMusicTree, saveMusicMedia } from "@/lib/admin/save-music-media";

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
  revalidateMediaItems: vi.fn(),
  revalidateAllMedia: vi.fn(),
}));
vi.mock("@/lib/admin/save-music-media", () => ({
  saveMusicMedia: vi.fn(async () => "44444444-4444-4444-8444-444444444444"),
  deleteMusicTree: vi.fn(async () => "album"),
  SaveMusicMediaError: class SaveMusicMediaError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.code = code;
    }
  },
}));

const saved = "44444444-4444-4444-8444-444444444444";
const season = "22222222-2222-4222-8222-222222222222";
const rpc = vi.fn();

function episodeForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: "",
    type: "tv_episode",
    title: "第 8 集",
    parent_id: season,
    number: "8",
    status: "want_to_watch",
    ...extra,
  }))
    form.set(key, value);
  return form;
}

const target = vi.fn();
const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: target }) }) }));

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: saved, error: null });
  target.mockResolvedValue({ data: { type: "movie" }, error: null });
  vi.mocked(requireOwner).mockResolvedValue({ db: { rpc, from }, user: {} } as unknown as Awaited<
    ReturnType<typeof requireOwner>
  >);
});

describe("deleteMedia", () => {
  /** /manage 已是概览页，删除后回到条目所属的列表；季与单集归入电视节目。 */
  it.each([
    ["movie", "movie"],
    ["tv_show", "tv_show"],
    ["tv_season", "tv_show"],
    ["tv_episode", "tv_show"],
    ["album", "album"],
    ["music", "album"],
  ])("删除%s后回到 %s 列表", async (type, list) => {
    target.mockResolvedValue({ data: { type }, error: null });
    const form = new FormData();
    form.set("id", saved);
    form.set("confirm_title", "标题");
    await deleteMedia({}, form);
    if (type === "album" || type === "music") {
      expect(deleteMusicTree).toHaveBeenCalledWith(expect.anything(), saved, "标题");
      expect(rpc).not.toHaveBeenCalled();
    } else {
      expect(rpc).toHaveBeenCalledWith("admin_delete_media", expect.anything());
    }
    expect(redirect).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^/manage\\?type=${list}&deleted=1&n=\\d+$`)),
    );
  });
});

describe("saveMedia 专辑／曲目", () => {
  it("专辑保存走 saveMusicMedia 而非 manage_save_media", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      type: "album",
      title: "测试专辑",
      release_date: "2024-01-01",
      after: "continue",
    }))
      form.set(key, value);
    const result = await saveMedia({}, form);
    expect(result).toEqual({ saved: true, id: saved });
    expect(saveMusicMedia).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("saveMedia 快速新增", () => {
  it("连续录入时留在当前页：刷新数据并返回新条目，不跳转", async () => {
    const result = await saveMedia({}, episodeForm({ after: "continue" }));
    expect(result).toEqual({ saved: true, id: saved });
    expect(revalidateMediaItems).toHaveBeenCalledWith([saved]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("未选择连续录入时打开新条目", async () => {
    await saveMedia({}, episodeForm({ after: "open" }));
    expect(redirect).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^/manage/media/${saved}\\?saved=1&n=\\d+$`)),
    );
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

describe("saveMedia 封面", () => {
  const cover = "https://image.tmdb.org/t/p/original/poster.jpg";
  const show = "11111111-1111-4111-8111-111111111111";

  /** 取出写入 RPC 的封面，确认服务端保存的是丢掉或保留之后的值。 */
  function savedCover() {
    return rpc.mock.calls[0]?.[1]?.p_data?.cover_url;
  }

  it("新建季时丢掉提交的封面，写入 null", async () => {
    await saveMedia(
      {},
      episodeForm({
        type: "tv_season",
        title: "第 1 季",
        parent_id: show,
        number: "1",
        cover_url: "https://evil.example/poster.jpg",
        after: "continue",
      }),
    );
    expect(savedCover()).toBeNull();
    expect(rpc).toHaveBeenCalledWith(
      "manage_save_media",
      expect.objectContaining({ p_data: expect.objectContaining({ type: "tv_season", id: null, cover_url: null }) }),
    );
  });

  it("更新季时丢掉新封面，不改成提交的地址", async () => {
    await saveMedia(
      {},
      episodeForm({
        id: saved,
        type: "tv_season",
        title: "第 1 季",
        parent_id: show,
        number: "1",
        cover_url: cover,
        after: "continue",
      }),
    );
    expect(savedCover()).toBeNull();
    expect(rpc.mock.calls[0][1].p_data.id).toBe(saved);
    expect(rpc.mock.calls[0][1].p_data.cover_url).not.toBe(cover);
  });

  it.each([
    ["movie", { type: "movie", title: "测试电影" }],
    ["tv_show", { type: "tv_show", title: "测试剧集" }],
    ["tv_episode", { type: "tv_episode", title: "第 8 集", parent_id: season, number: "8" }],
  ] as const)("新建%s保留封面", async (_label, fields) => {
    await saveMedia({}, episodeForm({ ...fields, cover_url: cover, after: "continue" }));
    expect(savedCover()).toBe(cover);
  });

  it.each([
    ["movie", { type: "movie", title: "测试电影" }],
    ["tv_show", { type: "tv_show", title: "测试剧集" }],
    ["tv_episode", { type: "tv_episode", title: "第 8 集", parent_id: season, number: "8" }],
  ] as const)("更新%s保留封面", async (_label, fields) => {
    await saveMedia({}, episodeForm({ id: saved, ...fields, cover_url: cover, after: "continue" }));
    expect(savedCover()).toBe(cover);
    expect(rpc.mock.calls[0][1].p_data.id).toBe(saved);
  });
});
