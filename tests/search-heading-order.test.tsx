import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSyncExternalStore } from "react";
import SearchClient from "@/app/search/SearchClient";
import { buildMediaSearchQuery } from "@/lib/api/search-state";
import type { MediaCard } from "@/lib/types";

vi.mock(
  "next/navigation",
  /* 模拟搜索路由，并使搜索参数订阅浏览器地址变化。 */ () => ({
    usePathname: /* 固定返回搜索页路径。 */ () => "/search",
    useSearchParams: /* 用外部存储订阅读取地址中的查询串。 */ () =>
      new URLSearchParams(
        useSyncExternalStore(
          (notify) => {
            window.addEventListener("popstate", notify);
            return () => window.removeEventListener("popstate", notify);
          },
          () => window.location.search,
        ),
      ),
  }),
);

const options = { genres: [], regions: [], languages: [], years: [] };

const row: MediaCard = {
  id: "movie-1",
  title: "测试电影：星光档案",
  date: "2024-01-01",
  release_year: "2024",
  rating: 8.5,
  genres: ["剧情"],
  languages: ["汉语"],
  cover_url: "",
  type: "movies",
  status: "watched",
};

describe("search heading order", () => {
  it("keeps result titles as h2 directly under the page h1", () => {
    window.history.replaceState(null, "", "/search?q=星光");
    const key = buildMediaSearchQuery(new URLSearchParams(window.location.search));
    render(<SearchClient initialOptions={options} initialResult={{ rows: [row], total: 1, key, error: null }} />);

    const mainHeading = screen.getByRole("heading", { level: 1, name: /星光/ });
    expect(mainHeading).toBeInTheDocument();

    const cardTitle = screen.getByRole("heading", { level: 2, name: "测试电影：星光档案" });
    expect(cardTitle).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();

    const levels = screen.getAllByRole("heading").map((heading) => Number(heading.tagName.slice(1)));
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1);
    }

    expect(within(mainHeading.closest("section")!).getByRole("heading", { level: 2 })).toBe(cardTitle);
  });
});
