import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AnimatedNumber", () => ({
  default: ({ value }: { value: number }) => <>{value}</>,
}));

import CategoryHeaderCards from "@/components/dashboard/CategoryHeaderCards";

describe("CategoryHeaderCards", () => {
  it("shows 暂无评分 when avgRating is null", () => {
    render(
      <CategoryHeaderCards
        year="全时段"
        categoryName="电影"
        watchedCount={0}
        totalCount={0}
        watchedPercent={0}
        avgRating={null}
        avgRatingPercent={0}
      />,
    );
    expect(screen.getByText("暂无评分")).toBeInTheDocument();
    expect(screen.queryByText("/ 10")).not.toBeInTheDocument();
  });

  it("renders the numeric rating when present", () => {
    render(
      <CategoryHeaderCards
        year="2024"
        categoryName="电影"
        watchedCount={2}
        totalCount={5}
        watchedPercent={40}
        avgRating={8.2}
        avgRatingPercent={82}
      />,
    );
    expect(screen.getByText("8.2")).toBeInTheDocument();
    expect(screen.getByText("/ 10")).toBeInTheDocument();
    expect(screen.queryByText("暂无评分")).not.toBeInTheDocument();
  });
});
