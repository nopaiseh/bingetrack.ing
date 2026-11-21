import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt ?? ""} />
  ),
}));

const previewMusicCoversRematch = vi.fn();
const applyMusicCoversRematch = vi.fn();

vi.mock("@/app/(admin)/manage/rematch-cover-actions", () => ({
  previewMusicCoversRematch: (...args: unknown[]) => previewMusicCoversRematch(...args),
  applyMusicCoversRematch: (...args: unknown[]) => applyMusicCoversRematch(...args),
}));

import RematchCoversClient from "@/app/(admin)/manage/tools/rematch-covers/RematchCoversClient";

const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const mz = "https://is1-ssl.mzstatic.com/image/thumb/Music/old/600x600bb.jpg";
const mzNew = "https://is1-ssl.mzstatic.com/image/thumb/Music/new/600x600bb.jpg";

describe("RematchCoversClient selection defaults", () => {
  beforeEach(() => {
    previewMusicCoversRematch.mockReset();
    applyMusicCoversRematch.mockReset();
  });

  it("leaves every preview row unchecked, including clear-only rows", async () => {
    previewMusicCoversRematch.mockResolvedValue({
      ok: true,
      hasMore: false,
      nextCursor: trackId,
      skipped: 0,
      rows: [
        {
          id: albumId,
          type: "album",
          title: "叶惠美",
          artist: "周杰伦",
          oldCover: mz,
          newCover: mzNew,
          willChange: true,
          skipped: false,
        },
        {
          id: trackId,
          type: "album",
          title: "错图",
          artist: "某人",
          oldCover: mz,
          newCover: null,
          willChange: true,
          skipped: false,
        },
      ],
    });

    render(<RematchCoversClient />);
    await userEvent.click(screen.getByRole("button", { name: "预览本批" }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "选择 叶惠美" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "选择 错图" })).not.toBeChecked();
    });

    await userEvent.click(screen.getByRole("button", { name: "全选有新图的行" }));
    expect(screen.getByRole("checkbox", { name: "选择 叶惠美" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择 错图" })).not.toBeChecked();
  });
});
