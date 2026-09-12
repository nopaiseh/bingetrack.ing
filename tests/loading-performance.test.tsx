/* eslint-disable @next/next/no-html-link-for-pages */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import {
  AdminLoadingSkeleton,
  SeasonDetailLoadingSkeleton,
  CatalogLoadingSkeleton,
  HomeLoadingSkeleton,
  PosterRowSkeleton,
  SkeletonBlock,
} from "@/components/LoadingSkeletons";
import NavigationProgressBar from "@/components/NavigationProgressBar";

let mockPathname = "/";
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

test("SkeletonBlock renders with shimmer-wave class", () => {
  render(<SkeletonBlock className="h-10 w-20" />);
  const el = document.querySelector(".shimmer-wave");
  expect(el).toBeInTheDocument();
  expect(el).toHaveClass("h-10", "w-20", "rounded-xl");
});

test("AdminLoadingSkeleton renders accessible label and structured placeholders", () => {
  render(<AdminLoadingSkeleton />);
  const section = screen.getByLabelText("正在加载管理后台");
  expect(section).toBeInTheDocument();
  const shimmers = section.querySelectorAll(".shimmer-wave");
  expect(shimmers.length).toBeGreaterThan(10);
});

test("SeasonDetailLoadingSkeleton renders accessible label and placeholders", () => {
  render(<SeasonDetailLoadingSkeleton />);
  const container = screen.getByLabelText("正在加载本季剧集");
  expect(container).toBeInTheDocument();
  const shimmers = container.querySelectorAll(".shimmer-wave");
  expect(shimmers.length).toBeGreaterThan(10);
});

test("CatalogLoadingSkeleton and HomeLoadingSkeleton render correctly", () => {
  const { unmount: unmountCatalog } = render(<CatalogLoadingSkeleton />);
  expect(screen.getByLabelText("正在加载媒体目录")).toBeInTheDocument();
  unmountCatalog();

  render(<HomeLoadingSkeleton />);
  expect(screen.getByLabelText("正在加载首页")).toBeInTheDocument();
});

test("PosterRowSkeleton renders 6 poster skeletons", () => {
  const { container } = render(<PosterRowSkeleton />);
  const posters = container.querySelectorAll(".surface-card");
  expect(posters).toHaveLength(6);
});

test("NavigationProgressBar starts on internal link click and finishes on route change", async () => {
  const { unmount, rerender } = render(
    <div>
      <NavigationProgressBar />
      <a href="/movies" id="nav-link">电影</a>
      <a href="#anchor" id="hash-link">锚点</a>
      <a href="https://example.com" id="external-link">外部</a>
    </div>
  );

  // Initially hidden
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

  // Clicking an external link or hash link does not trigger progress bar
  const externalLink = document.getElementById("external-link")!;
  await userEvent.click(externalLink);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

  const hashLink = document.getElementById("hash-link")!;
  await userEvent.click(hashLink);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

  // Clicking an internal navigation link triggers progressbar
  const internalLink = document.getElementById("nav-link")!;
  await userEvent.click(internalLink);

  const progressbar = screen.getByRole("progressbar");
  expect(progressbar).toBeInTheDocument();
  expect(progressbar).toHaveAttribute("aria-valuenow", "30");

  // Route changes -> finishes to 100%
  act(() => {
    mockPathname = "/movies";
  });
  rerender(
    <div>
      <NavigationProgressBar />
      <a href="/movies" id="nav-link">电影</a>
    </div>
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

  expect(progressbar).toHaveAttribute("aria-valuenow", "100");
  unmount();
});

