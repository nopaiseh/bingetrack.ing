import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MediaCardStatusBadge, { getStatusBadgeConfig } from "@/components/MediaCardStatusBadge";

describe("MediaCardStatusBadge", () => {
  it("returns correct config for watched status", () => {
    const config = getStatusBadgeConfig("watched");
    expect(config).not.toBeNull();
    expect(config?.label).toBe("已看");
    expect(config?.textClass).toContain("var(--ok)");
    expect(config?.dotClass).toContain("var(--ok)");
  });

  it("returns correct config for watching status with pulse", () => {
    const config = getStatusBadgeConfig("watching");
    expect(config).not.toBeNull();
    expect(config?.label).toBe("在看");
    expect(config?.pulse).toBe(true);
    expect(config?.textClass).toContain("var(--warn)");
    expect(config?.dotClass).toContain("var(--warn)");
  });

  it("returns correct config for want_to_watch status", () => {
    const config = getStatusBadgeConfig("want_to_watch");
    expect(config).not.toBeNull();
    expect(config?.label).toBe("想看");
    expect(config?.textClass).toContain("var(--accent-hover)");
    expect(config?.dotClass).toContain("var(--accent)");
  });

  it("rejects Chinese and other non-enum status strings", () => {
    expect(getStatusBadgeConfig("已看")).toBeNull();
    expect(getStatusBadgeConfig("在看")).toBeNull();
    expect(getStatusBadgeConfig("想看")).toBeNull();
    expect(getStatusBadgeConfig("已观看")).toBeNull();
    expect(getStatusBadgeConfig("正在看")).toBeNull();
    expect(getStatusBadgeConfig("想要看")).toBeNull();
    expect(getStatusBadgeConfig("读过")).toBeNull();
  });

  it("returns null for untracked, empty or unknown status", () => {
    expect(getStatusBadgeConfig(undefined)).toBeNull();
    expect(getStatusBadgeConfig(null)).toBeNull();
    expect(getStatusBadgeConfig("")).toBeNull();
    expect(getStatusBadgeConfig("unwatched")).toBeNull();
  });

  it("renders watched badge with solid ok colors and accessible label", () => {
    render(<MediaCardStatusBadge status="watched" />);
    const badge = screen.getByTestId("media-card-status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("已看");
    expect(badge).toHaveAttribute("aria-label", "观看状态：已看");
    expect(badge.className).toContain("text-[var(--ok)]");
    expect(badge.className).toContain("bg-[var(--canvas)]");
  });

  it("renders watching badge with warn pulse animation", () => {
    render(<MediaCardStatusBadge status="watching" />);
    const badge = screen.getByTestId("media-card-status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("在看");
    expect(badge.querySelector(".animate-ping")).toBeInTheDocument();
    expect(badge.className).toContain("text-[var(--warn)]");
  });

  it("renders want_to_watch badge with accent colors", () => {
    render(<MediaCardStatusBadge status="want_to_watch" />);
    const badge = screen.getByTestId("media-card-status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("想看");
    expect(badge.className).toContain("text-[var(--accent-hover)]");
  });

  it("renders nothing when status is not provided", () => {
    const { container } = render(<MediaCardStatusBadge status={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("maps in_progress to 在读 and book kind uses reading verbs", () => {
    expect(getStatusBadgeConfig("in_progress")?.label).toBe("在读");
    expect(getStatusBadgeConfig("watched", "book")?.label).toBe("读过");
    expect(getStatusBadgeConfig("want_to_watch", "book")?.label).toBe("想读");
    expect(getStatusBadgeConfig("in_progress", "book")?.label).toBe("在读");

    render(<MediaCardStatusBadge status="in_progress" kind="book" placement="inline" />);
    const badge = screen.getByTestId("media-card-status-badge");
    expect(badge).toHaveTextContent("在读");
    expect(badge).toHaveAttribute("aria-label", "阅读状态：在读");
  });
});
