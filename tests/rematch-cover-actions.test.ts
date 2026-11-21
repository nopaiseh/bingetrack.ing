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
const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const mz = "https://is1-ssl.mzstatic.com/image/thumb/Music/old/600x600bb.jpg";

describe("rematch cover actions auth", () => {
  beforeEach(() => {
    vi.mocked(requireOwner).mockReset();
    vi.mocked(listMzstaticMusicItems).mockReset();
    vi.mocked(previewMusicCoverRematch).mockReset();
    vi.mocked(applyMusicCoverRematch).mockReset();
  });

  it("preview requires owner and passes afterId cursor", async () => {
    vi.mocked(requireOwner).mockResolvedValue({ db: {} as never, user: { id: "owner" } as never });
    vi.mocked(listMzstaticMusicItems).mockResolvedValue({
      items: [{ id: trackId, type: "album", title: "叶惠美", cover_url: mz, artist: "周杰伦" }],
      nextCursor: trackId,
      hasMore: false,
    });
    vi.mocked(previewMusicCoverRematch).mockResolvedValue({
      rows: [
        {
          id: trackId,
          type: "album",
          title: "叶惠美",
          artist: "周杰伦",
          oldCover: mz,
          newCover: null,
          willChange: true,
          skipped: false,
        },
      ],
      nextCursor: trackId,
      hasMore: false,
      skipped: 0,
    });

    await expect(previewMusicCoversRematch(albumId)).resolves.toEqual({
      ok: true,
      hasMore: false,
      nextCursor: trackId,
      skipped: 0,
      rows: [
        {
          id: trackId,
          type: "album",
          title: "叶惠美",
          artist: "周杰伦",
          oldCover: mz,
          newCover: null,
          willChange: true,
          skipped: false,
        },
      ],
    });
    expect(listMzstaticMusicItems).toHaveBeenCalledWith({}, { limit: 20, afterId: albumId });
  });

  it("preview keeps afterId when the whole batch is skipped by deadline", async () => {
    vi.mocked(requireOwner).mockResolvedValue({ db: {} as never, user: { id: "owner" } as never });
    vi.mocked(listMzstaticMusicItems).mockResolvedValue({
      items: [{ id: trackId, type: "album", title: "叶惠美", cover_url: mz, artist: null }],
      nextCursor: trackId,
      hasMore: true,
    });
    vi.mocked(previewMusicCoverRematch).mockResolvedValue({
      rows: [
        {
          id: trackId,
          type: "album",
          title: "叶惠美",
          artist: null,
          oldCover: mz,
          newCover: null,
          willChange: false,
          skipped: true,
        },
      ],
      nextCursor: null,
      hasMore: true,
      skipped: 1,
    });

    await expect(previewMusicCoversRematch(albumId)).resolves.toMatchObject({
      ok: true,
      hasMore: true,
      nextCursor: albumId,
      skipped: 1,
    });
  });

  it("preview rejects when not owner", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(previewMusicCoversRematch()).rejects.toThrow("NEXT_REDIRECT");
    expect(listMzstaticMusicItems).not.toHaveBeenCalled();
  });

  it("apply requires owner and only submits parsed payload with optimistic lock field", async () => {
    vi.mocked(requireOwner).mockResolvedValue({ db: {} as never, user: { id: "owner" } as never });
    vi.mocked(applyMusicCoverRematch).mockResolvedValue({
      succeeded: 1,
      failed: 0,
      cleared: 1,
      conflicted: 0,
      conflictIds: [],
      succeededIds: [albumId],
    });

    await expect(applyMusicCoversRematch([{ id: albumId, cover_url: null, expected_cover_url: mz }])).resolves.toEqual({
      ok: true,
      succeeded: 1,
      failed: 0,
      cleared: 1,
      conflicted: 0,
      conflictIds: [],
      succeededIds: [albumId],
    });
    expect(applyMusicCoverRematch).toHaveBeenCalledWith({}, [{ id: albumId, cover_url: null, expected_cover_url: mz }]);
  });

  it("apply rejects when not owner", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(applyMusicCoversRematch([{ id: albumId, cover_url: null, expected_cover_url: mz }])).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(applyMusicCoverRematch).not.toHaveBeenCalled();
  });
});
