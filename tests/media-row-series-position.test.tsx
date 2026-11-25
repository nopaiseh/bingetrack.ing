import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MediaRow, { formatSeriesPositionLabel } from "@/components/MediaRow";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

function book(overrides: Partial<MediaCard> = {}): MediaCard {
  return {
    id: "b1",
    title: "百年孤独",
    date: "1967-01-01",
    release_year: "1967",
    rating: null,
    genres: [],
    languages: [],
    cover_url: "https://image.tmdb.org/t/p/w342/book.jpg",
    type: "books",
    dbType: "book",
    status: undefined,
    ...overrides,
  };
}

describe("formatSeriesPositionLabel", () => {
  it("只接受非负整数，缺省与小数不编造序号", () => {
    expect(formatSeriesPositionLabel(1)).toBe("第1部");
    expect(formatSeriesPositionLabel(0)).toBe("第0部");
    expect(formatSeriesPositionLabel(12)).toBe("第12部");
    expect(formatSeriesPositionLabel(null)).toBeNull();
    expect(formatSeriesPositionLabel(undefined)).toBeNull();
    expect(formatSeriesPositionLabel(1.5)).toBeNull();
    expect(formatSeriesPositionLabel(-1)).toBeNull();
  });
});

describe("MediaRow showSeriesPosition", () => {
  it("默认不显示系列序号角标", () => {
    render(<MediaRow title="系列" items={[book({ seriesPosition: 2 })]} type="book" hideStatusBadge />);
    expect(screen.queryByTestId("media-card-series-position")).not.toBeInTheDocument();
  });

  it("开启后有 seriesPosition 时显示「第 N 部」，文案可读且带无障碍标签", () => {
    render(
      <MediaRow
        title="《马尔克斯》系列"
        items={[book({ seriesPosition: 3, title: "霍乱时期的爱情" })]}
        type="book"
        showSeriesPosition
        hideStatusBadge
      />,
    );
    const badge = screen.getByTestId("media-card-series-position");
    expect(badge).toHaveTextContent("第3部");
    expect(badge).toHaveAttribute("aria-label", "系列第3部");
    expect(badge.className).toContain("text-fg-muted");
    expect(badge.className).toContain("bg-[var(--canvas)]");
  });

  it("开启后缺 seriesPosition 时隐藏角标，不按列表下标编造", () => {
    render(
      <MediaRow
        title="系列"
        items={[book({ id: "a", title: "甲" }), book({ id: "b", title: "乙", seriesPosition: null })]}
        type="book"
        showSeriesPosition
        hideStatusBadge
      />,
    );
    expect(screen.queryByTestId("media-card-series-position")).not.toBeInTheDocument();
    expect(screen.queryByText(/第\d+部/)).not.toBeInTheDocument();
  });

  it("模拟 getRelatedBySeries 返回：有序位显示，null／缺省不显示、不按数组下标编号", () => {
    // 与 detail.ts 一致：mapViewRowToMediaCard 后再附带 seriesPosition（可为 null）。
    const fromRelatedBySeries: MediaCard[] = [
      { ...book({ id: "p2", title: "第二部" }), seriesPosition: 2 },
      { ...book({ id: "pnull", title: "无序位" }), seriesPosition: null },
      book({ id: "pundef", title: "未附带序位" }),
      { ...book({ id: "p5", title: "第五部" }), seriesPosition: 5 },
    ];
    render(
      <MediaRow
        title="《金庸作品集》系列"
        items={fromRelatedBySeries}
        type="book"
        showSeriesPosition
        hideStatusBadge
      />,
    );

    const badges = screen.getAllByTestId("media-card-series-position");
    expect(badges.map((node) => node.textContent)).toEqual(["第2部", "第5部"]);
    expect(
      within(screen.getByRole("link", { name: /第二部/ })).getByTestId("media-card-series-position"),
    ).toHaveTextContent("第2部");
    expect(
      within(screen.getByRole("link", { name: /第五部/ })).getByTestId("media-card-series-position"),
    ).toHaveTextContent("第5部");
    expect(within(screen.getByRole("link", { name: /无序位/ })).queryByTestId("media-card-series-position")).toBeNull();
    expect(
      within(screen.getByRole("link", { name: /未附带序位/ })).queryByTestId("media-card-series-position"),
    ).toBeNull();
    // 不得把数组下标当成「第1部」「第3部」等编造出来。
    expect(screen.queryByText("第1部")).not.toBeInTheDocument();
    expect(screen.queryByText("第3部")).not.toBeInTheDocument();
    expect(screen.queryByText("第4部")).not.toBeInTheDocument();
  });

  it("无封面字块上仍可显示系列序号；专辑 1:1 封面同样支持", () => {
    const { rerender } = render(
      <MediaRow
        title="系列"
        items={[book({ cover_url: "", seriesPosition: 1, title: "无封面书" })]}
        type="book"
        showSeriesPosition
        hideStatusBadge
      />,
    );
    const bookLink = screen.getByRole("link", { name: /无封面书/ });
    expect(bookLink.querySelector(".letter-tile")).toBeTruthy();
    expect(within(bookLink).getByTestId("media-card-series-position")).toHaveTextContent("第1部");

    rerender(
      <MediaRow
        title="系列"
        type="album"
        showSeriesPosition
        hideStatusBadge
        items={[
          book({
            id: "a1",
            title: "叶惠美",
            type: "albums",
            dbType: "album",
            cover_url: "",
            artists: ["周杰伦"],
            seriesPosition: 2,
          }),
        ]}
      />,
    );
    const albumLink = screen.getByRole("link", { name: /叶惠美/ });
    expect(albumLink.querySelector(".letter-tile")).toBeTruthy();
    expect(within(albumLink).getByTestId("media-card-series-position")).toHaveTextContent("第2部");
  });
});
