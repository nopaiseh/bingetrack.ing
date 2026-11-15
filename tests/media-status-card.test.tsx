import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MediaStatusCard from "@/components/dashboard/MediaStatusCard";

describe("MediaStatusCard", () => {
  it("links to the search page and shows the count and details", () => {
    render(
      <MediaStatusCard
        title="已看"
        icon="i-material-symbols-check-circle-outline-rounded"
        toneClass="text-[var(--ok)]"
        count={4}
        details="3季 · 12集"
        href="/search?type=tv_show&status=watched"
      />,
    );

    const link = screen.getByRole("link", { name: /已看/ });
    expect(link).toHaveAttribute("href", "/search?type=tv_show&status=watched");
    expect(link).toHaveClass("cursor-pointer");
    expect(link).toHaveTextContent("4");
    expect(link).toHaveTextContent("部");
    expect(link).toHaveTextContent("3季 · 12集");
    expect(link.querySelector("p")).not.toHaveAttribute("aria-hidden");
  });

  it("keeps a blank details line and is not a link when there is no href", () => {
    const { container } = render(
      <MediaStatusCard
        title="想看"
        icon="i-material-symbols-bookmark-outline-rounded"
        toneClass="text-[var(--accent-hover)]"
        count={0}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("想看")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    const details = container.querySelector("p");
    expect(details).toHaveAttribute("aria-hidden", "true");
    expect(details?.textContent).toBe("\u00a0");
  });
});
