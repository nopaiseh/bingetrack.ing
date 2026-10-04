import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import MediaInformation from "@/components/MediaInformation";
import type { Media } from "@/lib/types";

vi.mock("next/navigation", /* 详情返回入口使用无筛选的测试地址。 */ () => ({ useSearchParams: () => new URLSearchParams() }));

const media: Media = { id: "test", title: "测试作品", date: "2026-01-01", rating: 0, genres: [], languages: [], cover_url: "", type: "movies" };

test("renders placeholder when casts list is empty", () => {
  render(<MediaInformation media={{ ...media, casts: [] }} seasons={null} />);
  const castSection = screen.getByRole("heading", { name: "主演" }).parentElement!.parentElement!;
  expect(within(castSection).getByText("-")).toBeInTheDocument();
});

test("renders every cast member without a toggle button", () => {
  const casts = Array.from({ length: 15 }, (_, i) => `演员${i + 1}`);
  render(<MediaInformation media={{ ...media, casts }} seasons={null} />);
  for (const name of casts) expect(screen.getByRole("link", { name })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /演员/ })).not.toBeInTheDocument();
});

test("shows the character beside each actor while the link searches only the actor", () => {
  render(<MediaInformation media={{ ...media, casts: ["演员1", "演员2"], characters: ["角色甲", null] }} seasons={null} />);
  const link = screen.getByRole("link", { name: "演员1 饰 角色甲" });
  expect(link).toHaveAttribute("href", "/search?q=%E6%BC%94%E5%91%981&type=actor");
  expect(screen.getByRole("link", { name: "演员2" })).toBeInTheDocument();
});
