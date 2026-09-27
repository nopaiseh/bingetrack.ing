import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import UpcomingHero from "@/components/UpcomingHero";
import type { UpcomingRelease } from "@/lib/types";

const mockItems: UpcomingRelease[] = [
  {
    id: "dune-3",
    kind: "movie",
    groupId: "dune-3",
    title: "沙丘3",
    releaseDate: "2026-10-09",
    cover_url: "https://example.com/dune.jpg",
    href: "/movies/dune-3",
    genres: ["科幻", "冒险"],
    languages: ["英语"],
    summary: "保罗·厄崔迪登上帝位后的故事。",
  },
  {
    id: "ep-5",
    kind: "episode",
    groupId: "severance",
    title: "人生切割术",
    subtitle: "第 3 季 · 第 5 集 · 回声",
    releaseDate: "2026-09-28",
    cover_url: "https://example.com/severance.jpg",
    href: "/shows/severance/seasons/s3",
    genres: ["悬疑"],
    languages: ["英语"],
  },
  {
    id: "ep-6",
    kind: "episode",
    groupId: "severance",
    title: "人生切割术",
    subtitle: "第 3 季 · 第 6 集",
    releaseDate: "2026-10-05",
    cover_url: "https://example.com/severance.jpg",
    href: "/shows/severance/seasons/s3",
    genres: ["悬疑"],
    languages: ["英语"],
  },
  {
    id: "past-movie",
    kind: "movie",
    groupId: "past-movie",
    title: "已上映电影",
    releaseDate: "2026-09-20",
    cover_url: "",
    href: "/movies/past-movie",
    genres: [],
    languages: [],
  },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 27, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

test("没有未来条目时整块隐藏", () => {
  const { container } = render(<UpcomingHero items={[mockItems[3]]} />);
  expect(container).toBeEmptyDOMElement();
});

test("按日期先展示最近的一条，每部剧只保留下一集，并排除已上映条目", () => {
  render(<UpcomingHero items={mockItems} renderedOn="2026-09-27" />);

  expect(screen.getByRole("region", { name: "即将上映倒计时" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "人生切割术" })).toBeInTheDocument();
  expect(screen.getByText("第 3 季 · 第 5 集 · 回声")).toBeInTheDocument();
  expect(screen.getByText("即将播出")).toBeInTheDocument();
  expect(screen.getByText("明天播出")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /查看本季/ })).toHaveAttribute("href", "/shows/severance/seasons/s3");

  expect(screen.getAllByRole("button", { name: /^切换展台为/ })).toHaveLength(2);
  expect(screen.queryByRole("button", { name: /已上映电影/ })).not.toBeInTheDocument();
});

test("切换缩略图后显示电影倒计时天数", async () => {
  const user = userEvent.setup();
  render(<UpcomingHero items={mockItems} />);

  await user.click(screen.getByRole("button", { name: "切换展台为 沙丘3（12 天）" }));

  expect(screen.getByRole("heading", { name: "沙丘3" })).toBeInTheDocument();
  expect(screen.getByText("即将上映")).toBeInTheDocument();
  expect(screen.getByText("距上映还有 12 天")).toBeInTheDocument();
  expect(screen.getByText(/保罗·厄崔迪/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /查看影片/ })).toHaveAttribute("href", "/movies/dune-3");
});

/** jsdom 没有 AnimationEvent，React 改为监听带前缀的事件名，这里两种都派发。 */
function finishProgress() {
  const bar = screen.getByTestId("upcoming-progress");
  fireEvent.animationEnd(bar);
  if (screen.queryByTestId("upcoming-progress") === bar) fireEvent(bar, new Event("webkitAnimationEnd", { bubbles: true }));
}

test("进度条走完后自动切到下一条，末尾回到第一条", () => {
  render(<UpcomingHero items={mockItems} />);
  expect(screen.getByRole("heading", { name: "人生切割术" })).toBeInTheDocument();

  finishProgress();
  expect(screen.getByRole("heading", { name: "沙丘3" })).toBeInTheDocument();

  finishProgress();
  expect(screen.getByRole("heading", { name: "人生切割术" })).toBeInTheDocument();
});

test("暂停按钮与悬停都会停住进度条", async () => {
  const user = userEvent.setup();
  render(<UpcomingHero items={mockItems} />);
  const section = screen.getByRole("region", { name: "即将上映倒计时" });
  const progress = () => screen.getByTestId("upcoming-progress");

  fireEvent.mouseLeave(section);
  expect(progress().style.animationPlayState).toBe("running");
  fireEvent.mouseEnter(section);
  expect(progress().style.animationPlayState).toBe("paused");
  fireEvent.mouseLeave(section);

  await user.click(screen.getByRole("button", { name: "暂停自动切换" }));
  fireEvent.mouseLeave(section);
  expect(progress().style.animationPlayState).toBe("paused");
  expect(screen.getByRole("button", { name: "继续自动切换" })).toBeInTheDocument();
});

test("最多展示十条候选", () => {
  const many = Array.from({ length: 12 }, (_, index): UpcomingRelease => ({
    ...mockItems[0],
    id: `movie-${index}`,
    groupId: `movie-${index}`,
    title: `电影${index}`,
    releaseDate: `2026-10-${String(index + 1).padStart(2, "0")}`,
  }));
  render(<UpcomingHero items={many} />);
  expect(screen.getAllByRole("button", { name: /^切换展台为/ })).toHaveLength(10);
});

test("系统要求减少动态效果时不自动轮播", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  try {
    render(<UpcomingHero items={mockItems} />);
    expect(screen.queryByTestId("upcoming-progress")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "暂停自动切换" })).not.toBeInTheDocument();
  } finally {
    vi.unstubAllGlobals();
  }
});

test("左右箭头循环切换条目", async () => {
  const user = userEvent.setup();
  render(<UpcomingHero items={mockItems} />);

  await user.click(screen.getByRole("button", { name: "下一条" }));
  expect(screen.getByRole("heading", { name: "沙丘3" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /沙丘3/ })).toHaveAttribute("aria-current", "true");

  await user.click(screen.getByRole("button", { name: "下一条" }));
  expect(screen.getByRole("heading", { name: "人生切割术" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "上一条" }));
  expect(screen.getByRole("heading", { name: "沙丘3" })).toBeInTheDocument();
});

test("只有一条时不显示箭头和进度条", () => {
  render(<UpcomingHero items={[mockItems[0]]} />);
  expect(screen.queryByRole("button", { name: "下一条" })).not.toBeInTheDocument();
  expect(screen.queryByTestId("upcoming-progress")).not.toBeInTheDocument();
});
