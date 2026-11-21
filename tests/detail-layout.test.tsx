import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClampedCopy from "@/components/ClampedCopy";
import MediaInformation from "@/components/MediaInformation";
import type { Media } from "@/lib/types";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

/** 让 ClampedCopy 在测量时认为正文溢出，从而渲染展开按钮。 */
function stubOverflowingResizeObserver() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        Object.defineProperty(target, "scrollHeight", { configurable: true, get: () => 200 });
        Object.defineProperty(target, "clientHeight", { configurable: true, get: () => 80 });
        this.callback([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

const media: Media = {
  id: "test",
  title: "完美音调",
  date: "2012-09-28",
  rating: 7.4,
  genres: ["喜剧"],
  languages: ["英语"],
  regions: ["美国"],
  cover_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
  type: "movies",
  runtime: 112,
  summary: "一段很长的剧情简介。".repeat(12),
};

describe("详情页窄屏布局", () => {
  beforeEach(() => {
    stubOverflowingResizeObserver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("标题旁是小海报，字号与搜索页一致，元信息在下一行，没有 TMDB 链接", () => {
    const { container } = render(
      <MediaInformation media={{ ...media, status: "watched" }} seasons={null} releaseDateLabel="2012-09-28" />,
    );
    const poster = container.querySelector("[data-poster]");
    expect(poster?.parentElement).toHaveClass("w-16", "sm:w-24");
    expect(poster?.querySelector("img")).toHaveAttribute("src", expect.stringContaining("poster.jpg"));
    expect(container.querySelector("[data-hero]")).not.toBeInTheDocument();
    const copy = screen.getByText(/一段很长的剧情简介/);
    expect(copy).toHaveClass("max-w-[70ch]", "line-clamp-4");
    expect(copy.closest("details")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开全文 ↓" })).toHaveAttribute("aria-expanded", "false");
    const title = screen.getByRole("heading", { level: 1, name: "完美音调" });
    expect(title).toHaveClass("text-3xl", "sm:text-4xl");
    expect(title).not.toHaveClass("sm:text-5xl");
    expect(screen.getByText("2012")).toBeInTheDocument();
    expect(screen.getByText("电影")).toBeInTheDocument();
    expect(screen.getByText("1 小时 52 分")).toBeInTheDocument();
    expect(screen.getByText("已看")).toBeInTheDocument();
    expect(screen.queryByText("即将上映")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "TMDB" })).not.toBeInTheDocument();
  });

  it("没有片长时元信息行省略片长", () => {
    render(
      <MediaInformation
        media={{ ...media, runtime: null, status: "watched" }}
        seasons={null}
        releaseDateLabel="2012-09-28"
      />,
    );
    expect(screen.queryByText(/小时|分钟/)).not.toBeInTheDocument();
    expect(screen.getByText("已看")).toBeInTheDocument();
  });

  it("上映日在未来时显示即将上映，在过去时不显示", () => {
    const { rerender } = render(
      <MediaInformation
        media={{ ...media, date: "2099-01-01", status: "want_to_watch" }}
        seasons={null}
        releaseDateLabel="2099-01-01"
      />,
    );
    expect(screen.getByLabelText("即将上映")).toBeInTheDocument();
    expect(screen.queryByText("想看")).not.toBeInTheDocument();

    rerender(
      <MediaInformation
        media={{ ...media, date: "2012-09-28", status: "want_to_watch" }}
        seasons={null}
        releaseDateLabel="2012-09-28"
      />,
    );
    expect(screen.queryByLabelText("即将上映")).not.toBeInTheDocument();
    expect(screen.getByText("想看")).toBeInTheDocument();
  });

  it("已看的未来日期仍显示已看，不显示即将上映", () => {
    render(
      <MediaInformation
        media={{ ...media, date: "2099-06-01", status: "watched" }}
        seasons={null}
        releaseDateLabel="2099-06-01"
      />,
    );
    expect(screen.queryByLabelText("即将上映")).not.toBeInTheDocument();
    expect(screen.getByText("已看")).toBeInTheDocument();
  });

  it("没有海报时用标题首字，剧照地址不再铺成页头", () => {
    const { container, rerender } = render(
      <MediaInformation
        media={{ ...media, cover_url: "", title: "复仇者联盟" }}
        seasons={null}
        releaseDateLabel="2026-12-18"
      />,
    );
    expect(container.querySelector("[data-poster] .letter-tile")).toHaveAttribute("data-initial", "复");
    expect(container.querySelector("[data-hero]")).not.toBeInTheDocument();

    rerender(
      <MediaInformation
        media={{ ...media, backdrop_url: "https://image.tmdb.org/t/p/w780/backdrop.jpg" }}
        seasons={null}
        releaseDateLabel="2026-12-18"
      />,
    );
    expect(container.querySelector("[data-hero]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-poster] img")).toHaveAttribute("src", expect.stringContaining("poster.jpg"));
  });

  it("短简介不提供展开控件", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    render(<ClampedCopy text="暂无简介。" />);
    expect(screen.getByText("暂无简介。")).toHaveClass("max-w-[70ch]");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("导演链接触控目标至少 44px 高且仍链到导演搜索", () => {
    render(
      <MediaInformation
        media={{ ...media, type: "shows", directors: ["王家卫"], status: "watched" }}
        seasons={null}
        releaseDateLabel="2012-09-28"
      />,
    );
    const link = screen.getByRole("link", { name: "王家卫" });
    expect(link).toHaveAttribute("href", "/search?q=%E7%8E%8B%E5%AE%B6%E5%8D%AB&creditRole=director");
    expect(link.className).toContain("min-h-11");
    expect(link.className).toContain("min-w-6");
    expect(link.className).toContain("inline-flex");
  });
});
