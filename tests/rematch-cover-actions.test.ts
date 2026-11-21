import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/admin/rematch-music-covers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/rematch-music-covers")>(
    "@/lib/admin/rematch-music-covers",
  );
  return {
    ...actual,
    listMzstaticMusicItems: vi.fn(),
    previewMusicCoverRematch: vi.fn(),
    applyMusicCoverRematch: vi.fn(),
  };
});
vi.mock("@/lib/report-error", () => ({ reportHandledError: vi.fn() }));

import { requireOwner } from "@/lib/auth/server";
import {
  applyMusicCoverRematch,
  listMzstaticMusicItems,
  previewMusicCoverRematch,
} from "@/lib/admin/rematch-music-covers";
import { applyMusicCoversRematch, previewMusicCoversRematch } from "@/app/(admin)/manage/rematch-cover-actions";

const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mz = "https://is1-ssl.mzstatic.com/image/thumb/Music/old/600x600bb.jpg";

describe("rematch cover actions auth", () => {
  beforeEach(() => {
    vi.mocked(requireOwner).mockReset();
    vi.mocked(listMzstaticMusicItems).mockReset();
    vi.mocked(previewMusicCoverRematch).mockReset();
    vi.mocked(applyMusicCoverRematch).mockReset();
  });

  it("preview requires owner and returns rows", async () => {
    vi.mocked(requireOwner).mockResolvedValue({ db: {} as never, user: { id: "owner" } as never });
    vi.mocked(listMzstaticMusicItems)
      .mockResolvedValueOnce([
        { id: albumId, type: "album", title: "叶惠美", cover_url: mz, artist: "周杰伦" },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(previewMusicCoverRematch).mockResolvedValue([
      {
        id: albumId,
        type: "album",
        title: "叶惠美",
        artist: "周杰伦",
        oldCover: mz,
        newCover: null,
        willChange: true,
      },
    ]);

    await expect(previewMusicCoversRematch()).resolves.toEqual({
      ok: true,
      truncated: false,
      rows: [
        {
          id: albumId,
          type: "album",
          title: "叶惠美",
          artist: "周杰伦",
          oldCover: mz,
          newCover: null,
          willChange: true,
        },
      ],
    });
  });

  it("preview rejects when not owner", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(previewMusicCoversRematch()).rejects.toThrow("NEXT_REDIRECT");
    expect(listMzstaticMusicItems).not.toHaveBeenCalled();
  });

  it("apply requires owner and only submits parsed payload", async () => {
    vi.mocked(requireOwner).mockResolvedValue({ db: {} as never, user: { id: "owner" } as never });
    vi.mocked(applyMusicCoverRematch).mockResolvedValue({ succeeded: 1, failed: 0, cleared: 1 });

    await expect(applyMusicCoversRematch([{ id: albumId, cover_url: null }])).resolves.toEqual({
      ok: true,
      succeeded: 1,
      failed: 0,
      cleared: 1,
    });
    expect(applyMusicCoverRematch).toHaveBeenCalledWith({}, [{ id: albumId, cover_url: null }]);
  });

  it("apply rejects when not owner", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(applyMusicCoversRematch([{ id: albumId, cover_url: null }])).rejects.toThrow("NEXT_REDIRECT");
    expect(applyMusicCoverRematch).not.toHaveBeenCalled();
  });
});
