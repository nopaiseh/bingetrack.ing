import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";

vi.mock("@/lib/functions/media-repo", () => ({
  fetchStatsServer: vi.fn().mockRejectedValue(new Error("Supabase outage")),
  fetchMediaCardsServer: vi.fn().mockRejectedValue(new Error("Supabase outage")),
}));

vi.mock("@/lib/functions/cached-media", () => ({
  getCachedReleaseYearStats: vi.fn().mockRejectedValue(new Error("Supabase outage")),
  getCachedTopMediaServer: vi.fn().mockRejectedValue(new Error("Supabase outage")),
  getCachedMediaDistributionsServer: vi.fn().mockRejectedValue(new Error("Supabase outage")),
}));

// Mock catalog and dashboard components to inspect props
vi.mock("@/app/series/SeriesCatalog", () => ({
  default: (props: unknown) => <div data-testid="series-catalog" data-props={JSON.stringify(props)} />,
}));

vi.mock("@/app/movies/MoviesCatalog", () => ({
  default: (props: unknown) => <div data-testid="movies-catalog" data-props={JSON.stringify(props)} />,
}));

vi.mock("@/app/HomeDashboard", () => ({
  default: (props: unknown) => <div data-testid="home-dashboard" data-props={JSON.stringify(props)} />,
}));

import SeriesPage from "@/app/series/page";
import MoviesPage from "@/app/movies/page";
import HomePage from "@/app/page";

describe("Prerender graceful fallbacks", () => {
  beforeEach(() => {
    process.env.NEXT_PHASE = "phase-production-build";
  });
  afterEach(() => {
    delete process.env.NEXT_PHASE;
  });

  it("SeriesPage 在数据加载抛错时不抛出异常并返回降级内容", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const pageJsx = await SeriesPage();
      const { getByTestId } = render(pageJsx);
      const catalogEl = getByTestId("series-catalog");
      const props = JSON.parse(catalogEl.getAttribute("data-props") || "{}");
      expect(props.watched).toEqual([]);
      expect(props.watching).toEqual([]);
      expect(props.want).toEqual([]);
      expect(props.stats).toEqual({ total: 0, watched: 0, watching: 0, want: 0, upcoming: 0 });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("MoviesPage 在数据加载抛错时不抛出异常并返回降级内容", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const pageJsx = await MoviesPage();
      const { getByTestId } = render(pageJsx);
      const catalogEl = getByTestId("movies-catalog");
      const props = JSON.parse(catalogEl.getAttribute("data-props") || "{}");
      expect(props.watched).toEqual([]);
      expect(props.want).toEqual([]);
      expect(props.stats).toEqual({ total: 0, watched: 0, want: 0, upcoming: 0 });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("HomePage 在数据加载抛错时不抛出异常并返回降级内容", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const pageJsx = await HomePage();
      const { getByTestId } = render(pageJsx);
      const dashboardEl = getByTestId("home-dashboard");
      const props = JSON.parse(dashboardEl.getAttribute("data-props") || "{}");
      expect(props.summary).toEqual([]);
      expect(props.topMovies).toEqual([]);
      expect(props.topSeries).toEqual([]);
      expect(props.distributions).toBeDefined();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("Runtime data failures", () => {
  // 运行期失败必须抛出，ISR 才会保留上一次成功生成的页面而不是缓存空数据。
  it.each([
    ["SeriesPage", SeriesPage],
    ["MoviesPage", MoviesPage],
    ["HomePage", HomePage],
  ])("%s 在运行期数据加载抛错时重新抛出", async (_name, Page) => {
    delete process.env.NEXT_PHASE;
    await expect(Page()).rejects.toThrow("Supabase outage");
  });
});
