import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BookInformation from "@/components/BookInformation";
import type { Media } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const base: Media = {
  id: "book-1",
  title: "测试图书",
  date: "2020-05-01",
  release_year: 2020,
  rating: 8.5,
  genres: ["小说"],
  languages: ["中文"],
  cover_url: "",
  type: "books",
  status: "in_progress",
  authors: ["作者甲"],
  summary: "一段简介。",
};

describe("BookInformation", () => {
  it("显示三态阅读状态与作者／出版社／页数", () => {
    render(<BookInformation media={base} publisher="测试出版社" pageCount={320} />);

    expect(screen.getByRole("heading", { name: "测试图书" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "阅读状态" })).toBeInTheDocument();
    expect(screen.getByText("想读")).toBeInTheDocument();
    expect(screen.getByText("在读")).toBeInTheDocument();
    expect(screen.getByText("读过")).toBeInTheDocument();
    expect(screen.getAllByText("作者甲").length).toBeGreaterThan(0);
    expect(screen.getAllByText("测试出版社").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/320/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("字段为空时不显示出版社与页数", () => {
    render(<BookInformation media={{ ...base, authors: [] }} publisher={null} pageCount={null} />);
    expect(screen.queryByText("出版社")).not.toBeInTheDocument();
    expect(screen.queryByText("页数")).not.toBeInTheDocument();
  });
});
