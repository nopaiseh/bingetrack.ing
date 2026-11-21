import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import SeasonTabList from "@/components/SeasonTabList";
import type { SeasonInfo } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const seasons: SeasonInfo[] = [
  {
    id: "s1",
    seasonNumber: 1,
    title: "第一季",
    coverUrl: "",
    episodeCount: 8,
    watchedEpisodeCount: 2,
  },
  {
    id: "s2",
    seasonNumber: 2,
    title: "第二季",
    coverUrl: "",
    episodeCount: 8,
    watchedEpisodeCount: 0,
  },
];

describe("SeasonTabList", () => {
  it("单季不渲染", () => {
    const { container } = render(<SeasonTabList seriesId="show" seasonId="s1" seasons={seasons.slice(0, 1)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("多季渲染导航，当前季带 aria-current，无 tab 角色", () => {
    const { container } = render(<SeasonTabList seriesId="show" seasonId="s2" seasons={seasons} />);
    const nav = screen.getByRole("navigation", { name: "选择季度" });
    expect(nav).toHaveClass("no-scrollbar");
    expect(screen.getByRole("link", { name: "第 2 季", current: "page" })).toHaveAttribute(
      "href",
      "/shows/show/seasons/s2",
    );
    expect(screen.getByRole("link", { name: "第 1 季" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(container.querySelector(".season-tab-scroller")).toBeInTheDocument();
  });
});
