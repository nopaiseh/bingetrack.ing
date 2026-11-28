import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import SongRelatedSection, { RELATED_SONGS_PREVIEW_COUNT } from "@/components/SongRelatedSection";
import type { RelatedSong } from "@/lib/types/song";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const currentSongId = "50000000-0000-4000-8000-000000000021";

function relatedList(count: number): RelatedSong[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `50000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`,
    title: `相关曲目 ${i + 1}`,
    cover_url: null,
    release_date: "2024-01-01",
    relations: ["artist"] as const,
  }));
}

describe("SongRelatedSection", () => {
  it("默认只展示前 6 首，展开全部后显示其余", async () => {
    const user = userEvent.setup();
    render(<SongRelatedSection related={relatedList(10)} currentSongId={currentSongId} />);

    expect(screen.getAllByRole("link")).toHaveLength(RELATED_SONGS_PREVIEW_COUNT);
    expect(screen.queryByText("相关曲目 7")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开全部" }));
    expect(screen.getAllByRole("link")).toHaveLength(10);
    expect(screen.getByText("相关曲目 7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "收起" }));
    expect(screen.getAllByRole("link")).toHaveLength(RELATED_SONGS_PREVIEW_COUNT);
  });

  it("不超过预览数时不显示展开按钮", () => {
    render(<SongRelatedSection related={relatedList(4)} currentSongId={currentSongId} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "展开全部" })).not.toBeInTheDocument();
  });

  it("无封面时使用字块回退", () => {
    const { container } = render(<SongRelatedSection related={relatedList(1)} currentSongId={currentSongId} />);
    expect(container.querySelector(".letter-tile")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
