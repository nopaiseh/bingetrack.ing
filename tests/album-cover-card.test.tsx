import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AlbumCoverCard from "@/components/AlbumCoverCard";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

function album(overrides: Partial<MediaCard> = {}): MediaCard {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "叶惠美",
    date: "2003-07-31",
    release_year: "2003",
    rating: 8.5,
    genres: [],
    languages: [],
    cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg",
    type: "albums",
    artists: ["周杰伦"],
    ...overrides,
  };
}

describe("AlbumCoverCard", () => {
  it("链接指向专辑详情，无障碍名称含标题与主艺人，正文展示两者与评分", () => {
    render(<AlbumCoverCard item={album()} />);
    const link = screen.getByRole("link", { name: "叶惠美，周杰伦" });
    expect(link).toHaveAttribute("href", "/albums/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(link).toHaveTextContent("叶惠美");
    expect(link).toHaveTextContent("周杰伦");
    expect(within(link).getByRole("presentation")).toHaveAttribute("alt", "");
    expect(link).toHaveTextContent("8.5");
  });

  it("无艺人时无障碍名称仅为标题，副行显示破折号占位", () => {
    render(<AlbumCoverCard item={album({ artists: [], title: "无名专辑" })} />);
    const link = screen.getByRole("link", { name: "无名专辑" });
    expect(link).toHaveAttribute("href", "/albums/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(link).toHaveTextContent("—");
  });

  it("空白标题回退为未命名专辑", () => {
    render(<AlbumCoverCard item={album({ title: "   ", artists: ["艺人"] })} />);
    expect(screen.getByRole("link", { name: "未命名专辑，艺人" })).toBeInTheDocument();
    expect(screen.getByText("未命名专辑")).toBeInTheDocument();
  });

  it("无封面时用装饰性首字块，不渲染图片", () => {
    render(<AlbumCoverCard item={album({ cover_url: "", title: "七里香" })} />);
    const link = screen.getByRole("link", { name: "七里香，周杰伦" });
    const tile = link.querySelector(".letter-tile");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveAttribute("data-initial", "七");
    expect(within(link).queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("无评分时不展示分数文案", () => {
    render(<AlbumCoverCard item={album({ rating: null })} />);
    expect(screen.getByRole("link", { name: "叶惠美，周杰伦" })).toBeInTheDocument();
    expect(screen.queryByText("8.5")).not.toBeInTheDocument();
  });
});
