import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import SpotlightHero from "@/components/SpotlightHero";
import type { MediaCard } from "@/lib/types";

const mockItems: MediaCard[] = [
  {
    id: "shawshank",
    title: "肖申克的救赎",
    date: "1994-09-10",
    release_year: 1994,
    rating: 9.7,
    genres: ["剧情", "犯罪"],
    languages: ["英语"],
    cover_url: "https://example.com/shawshank.jpg",
    type: "movies",
    status: "watched",
    summary: "一场谋杀案使银行家安迪蒙冤入狱，在肖申克监狱中他凭借坚毅与智慧寻求希望与救赎。",
  },
  {
    id: "interstellar",
    title: "星际穿越",
    date: "2014-11-07",
    release_year: 2014,
    rating: 9.4,
    genres: ["科幻", "冒险"],
    languages: ["英语"],
    cover_url: "https://example.com/interstellar.jpg",
    type: "movies",
    summary: "当近未来的地球面临荒漠化危机，一组宇航员穿过虫洞探索宜居的新星系。",
  },
  {
    id: "bad-movie",
    title: "纯正大烂片",
    date: "2020-01-01",
    release_year: 2020,
    rating: 2.1,
    genres: ["喜剧"],
    languages: ["汉语"],
    cover_url: "https://example.com/bad.jpg",
    type: "movies",
  },
];

test("renders empty when items array is empty", () => {
  const { container } = render(<SpotlightHero items={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test("renders first item as spotlight with title, description, genres and tier badge", () => {
  render(<SpotlightHero items={mockItems} yearLabel="1994" />);

  expect(screen.getByRole("region", { name: "焦点精选展台" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "肖申克的救赎" })).toBeInTheDocument();
  expect(screen.getByText(/一场谋杀案使银行家安迪蒙冤入狱/)).toBeInTheDocument();
  expect(screen.getByText("剧情")).toBeInTheDocument();
  expect(screen.getByText("犯罪")).toBeInTheDocument();
  expect(screen.getByText("神作")).toBeInTheDocument();
  expect(screen.getByText("9.7")).toBeInTheDocument();
  expect(screen.getByTestId("media-card-status-badge")).toHaveTextContent("已看");

  const ctaLink = screen.getByRole("link", { name: /查看影片|查看影剧/ });
  expect(ctaLink).toHaveAttribute("href", "/movies/shawshank");
});

test("clicking gallery thumbnail switches active spotlight item with description and genres", async () => {
  const user = userEvent.setup();
  render(<SpotlightHero items={mockItems} />);

  // Switch to Interstellar
  const interstellarThumb = screen.getByRole("tab", { name: "切换展台为 星际穿越" });
  await user.click(interstellarThumb);

  expect(screen.getByRole("heading", { name: "星际穿越" })).toBeInTheDocument();
  expect(screen.getByText(/一组宇航员穿过虫洞探索宜居的新星系/)).toBeInTheDocument();
  expect(screen.getByText("科幻")).toBeInTheDocument();
  expect(screen.getByText("9.4")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /查看影片|查看影剧/ })).toHaveAttribute("href", "/movies/interstellar");

  // Switch to bad-movie (which lacks summary, checks fallback description)
  const badMovieThumb = screen.getByRole("tab", { name: "切换展台为 纯正大烂片" });
  await user.click(badMovieThumb);

  expect(screen.getByRole("heading", { name: "纯正大烂片" })).toBeInTheDocument();
  expect(screen.getByText("烂片")).toBeInTheDocument();
  expect(screen.getByText("2.1")).toBeInTheDocument();
  expect(screen.getByText(/收录于影史与年度精选档案/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /查看影片|查看影剧/ })).toHaveAttribute("href", "/movies/bad-movie");
});

