import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { buildMediaDistributions } from "@/lib/functions/media-distributions";
import type { Summary } from "@/lib/types";

vi.mock("next/dynamic", () => ({
  default: () => function DynamicStub(props: { title?: string }) {
    return <div data-testid="dynamic" data-title={props.title ?? ""} />;
  },
}));

vi.mock("@/components/LoadingSkeletons", () => ({
  PosterRowSkeleton: () => <div data-testid="poster-skeleton" />,
}));

vi.mock("@/components/SpotlightHero", () => ({ default: () => null }));
vi.mock("@/components/AnimatedNumber", () => ({ default: ({ value }: { value: number }) => <>{value}</> }));

vi.mock("@/components/DashboardYearPicker", () => ({
  default: ({ years, onSelect }: { years: string[]; onSelect: (year: string) => void }) => (
    <div>
      {["All Time", ...years].map((year) => (
        <button key={year} type="button" onClick={() => onSelect(year)}>{`year-${year}`}</button>
      ))}
    </div>
  ),
}));

import HomeDashboard from "@/app/HomeDashboard";

describe("HomeDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("年份榜单请求未完成时切回全时段，不会停留在加载骨架", async () => {
    // 请求一直挂起，只在取消时拒绝，模拟用户在响应前切回全时段。
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));

    render(
      <HomeDashboard
        summary={[{ release_year: "2024" } as unknown as Summary]}
        topMovies={[]}
        topSeries={[]}
        distributions={buildMediaDistributions([])}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "电影" }));
    fireEvent.click(screen.getByText("year-2024"));
    expect(screen.getByTestId("poster-skeleton")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("year-All Time"));
    });

    expect(screen.queryByTestId("poster-skeleton")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("dynamic").some((element) => element.dataset.title === "影史精选")).toBe(true);
  });
});
