import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ContinueListeningRail, { type ContinueListeningCard } from "@/components/ContinueListeningRail";

function card(overrides: Partial<ContinueListeningCard> = {}): ContinueListeningCard {
  return {
    albumId: "album-1",
    title: "在听专辑",
    posterPath: null,
    href: "/albums/album-1",
    trackProgress: { watched: 2, total: 10 },
    ...overrides,
  };
}

describe("ContinueListeningRail", () => {
  it("hides the section when empty", () => {
    const { container } = render(<ContinueListeningRail items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the 在听 heading, progress, and album link", () => {
    render(<ContinueListeningRail items={[card()]} />);
    expect(screen.getByRole("heading", { name: "在听" })).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/albums/album-1");
    expect(link.className).toContain("w-40");
    expect(link.className).toContain("sm:w-48");
    expect(screen.getByText("在听专辑")).toBeInTheDocument();
    expect(screen.getByText("2/10 首")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "已听 2 首，共 10 首" })).toBeInTheDocument();
    expect(screen.getByLabelText("在听列表")).toHaveAttribute("tabindex", "0");
  });
});

