import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import QuickAddTrackDialog from "@/app/(admin)/manage/media/album/QuickAddTrackDialog";
import type { AlbumStructure } from "@/lib/admin/album-structure";

vi.mock("@/app/(admin)/manage/actions", () => ({ saveMedia: vi.fn() }));
vi.mock("@/app/(admin)/manage/reference-actions", () => ({
  searchChoices: vi.fn(async () => ({ choices: [] })),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
});

function albumStructure(artists: AlbumStructure["album"]["artists"]): AlbumStructure {
  return {
    album: {
      id: "album-1",
      title: "叶惠美",
      alternateTitle: null,
      coverUrl: null,
      status: "want_to_watch",
      rating: null,
      artists,
    },
    tracks: [],
    nextTrackNumber: 1,
  };
}

describe("快速加曲目弹窗", () => {
  it("有专辑艺人时预填演唱艺人人物 ID，提交字段带 ID\\t姓名", () => {
    const { container } = render(
      <QuickAddTrackDialog
        structure={albumStructure([{ id: "p1", name: "周杰伦", alternateName: "Jay Chou" }])}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "新增曲目" })).toBeInTheDocument();
    expect(screen.getByText("周杰伦")).toBeInTheDocument();
    const artists = container.querySelector('input[name="artists"]') as HTMLInputElement;
    expect(artists.value).toContain("p1\t周杰伦");
    expect(screen.getByText(/默认带上专辑艺人/)).toBeInTheDocument();
  });

  it("专辑没有艺人时演唱艺人保持空，仍可手动选择", () => {
    const { container } = render(<QuickAddTrackDialog structure={albumStructure([])} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "新增曲目" })).toBeInTheDocument();
    const artists = container.querySelector('input[name="artists"]') as HTMLInputElement;
    expect(artists.value).toBe("");
    expect(screen.getByText("还没有演唱艺人。在下方搜索名字即可添加。")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("添加演唱艺人")).toBeInTheDocument();
  });
});
