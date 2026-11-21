import { describe, expect, it } from "vitest";
import { getSearchViewAllLink, getStatusSearchLink } from "@/components/dashboard/dashboard-links";

describe("dashboard search links", () => {
  it("omits the year for All Time and keeps the status or rating sort", () => {
    expect(getStatusSearchLink("movie", "watched", "All Time")).toBe("/search?type=movie&status=watched");
    expect(getStatusSearchLink("tv_show", "watching", "All Time")).toBe("/search?type=tv_show&status=watching");
    expect(getStatusSearchLink("tv_show", "want_to_watch", "All Time")).toBe(
      "/search?type=tv_show&status=want_to_watch",
    );
    expect(getSearchViewAllLink("movie", "All Time")).toBe("/search?type=movie&sort=rating_desc");
    expect(getSearchViewAllLink("tv_show", "All Time")).toBe("/search?type=tv_show&sort=rating_desc");
  });

  it("limits a specific year to the same start and end", () => {
    expect(getStatusSearchLink("movie", "want_to_watch", "2023")).toBe(
      "/search?type=movie&status=want_to_watch&startYear=2023&endYear=2023",
    );
    expect(getSearchViewAllLink("tv_show", "1999")).toBe(
      "/search?type=tv_show&sort=rating_desc&startYear=1999&endYear=1999",
    );
  });

  it("supports book reading statuses including in_progress", () => {
    expect(getStatusSearchLink("book", "in_progress", "All Time")).toBe("/search?type=book&status=in_progress");
    expect(getStatusSearchLink("book", "want_to_watch", "2024")).toBe(
      "/search?type=book&status=want_to_watch&startYear=2024&endYear=2024",
    );
  });

  it("supports music singles for dashboard search links", () => {
    expect(getStatusSearchLink("music", "watched", "All Time")).toBe("/search?type=music&status=watched");
    expect(getStatusSearchLink("music", "want_to_watch", "2082")).toBe(
      "/search?type=music&status=want_to_watch&startYear=2082&endYear=2082",
    );
    expect(getSearchViewAllLink("music", "2081")).toBe(
      "/search?type=music&sort=rating_desc&startYear=2081&endYear=2081",
    );
  });
});
