import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import MediaInformation from "@/components/MediaInformation";
import MediaRow from "@/components/MediaRow";
import { SearchMediaCard } from "@/components/SearchMediaCard";
import type { Media } from "@/lib/types";

vi.mock("next/navigation", /* 详情返回入口使用无筛选的测试地址。 */ () => ({ useSearchParams: () => new URLSearchParams() }));

const media: Media = { id: "test", title: "测试作品", date: "2026-01-01", rating: 0, genres: [], languages: [], cover_url: "", type: "movies" };

test.each([0, null])("rating %s remains distinct from unrated across public views", /* 三种展示位置均区分零分和未评分。 */ (rating) => {
  const item = { ...media, rating };
  render(<><MediaInformation media={item} seasons={null} /><SearchMediaCard item={item} returnHref="/search" /><MediaRow title="电影" items={[item]} type="movies" /></>);
  expect(screen.getAllByText(rating === null ? "未评分" : "0.0")).toHaveLength(3);
  expect(screen.queryByText(rating === null ? "0.0" : "未评分")).not.toBeInTheDocument();
});
