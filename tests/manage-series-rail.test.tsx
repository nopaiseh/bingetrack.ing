import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SeriesRail from "@/app/(admin)/manage/media/series/SeriesRail";
import type { SeriesStructure } from "@/lib/admin/series-structure";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/** 生成指定季数的结构，最后一季展开并含指定集数。 */
function structure(seasonCount: number, episodeCount: number): SeriesStructure {
  const seasons = Array.from({ length: seasonCount }, (_, index) => ({ id: `s${index + 1}`, number: index + 1, title: `第 ${index + 1} 季`, episodeCount: index === seasonCount - 1 ? episodeCount : 10, status: "watched" as const }));
  const episodes = Array.from({ length: episodeCount }, (_, index) => ({ id: `e${index + 1}`, number: index + 1, title: `第 ${index + 1} 集`, watched: index < 2, releaseDate: null, runtime: null }));
  return {
    show: { id: "show", title: "人生切割术", alternateTitle: null, coverUrl: null, status: "watching", rating: 9.1 },
    seasons, expandedSeasonId: seasons.at(-1)?.id ?? null, episodes,
    totalEpisodes: seasons.reduce((sum, season) => sum + season.episodeCount, 0),
    nextSeasonNumber: seasonCount + 1,
    nextEpisode: { number: episodeCount + 1, releaseDate: null, runtime: null, afterTitle: null },
  };
}

describe("剧集结构栏", () => {
  it("季数不多时以树形列出，标记当前单集，并只在栏内提供新增季与单集", async () => {
    const onAdd = vi.fn();
    render(<SeriesRail structure={structure(2, 7)} current={{ type: "tv_episode", id: "e7" }} onAdd={onAdd} />);
    const rail = screen.getByRole("complementary", { name: "剧集结构" });
    expect(within(rail).getByRole("link", { name: /第 2 季/ })).toHaveAttribute("aria-expanded", "true");
    expect(within(rail).getByRole("link", { name: /第 7 集/ })).toHaveAttribute("aria-current", "page");
    expect(within(rail).queryByRole("combobox", { name: "选择季" })).not.toBeInTheDocument();
    await userEvent.click(within(rail).getByRole("button", { name: /新增第 8 集/ }));
    await userEvent.click(within(rail).getByRole("button", { name: "新增第 3 季" }));
    expect(onAdd.mock.calls).toEqual([["episode"], ["season"]]);
    expect(within(rail).getByText("在看 · 9.1")).toBeInTheDocument();
  });

  it("超过 8 季改用下拉选择季，单集较多时提供跳到集号，编号使用千位分隔", () => {
    render(<SeriesRail structure={structure(32, 1168)} current={{ type: "tv_season", id: "s32" }} onAdd={vi.fn()} />);
    const rail = screen.getByRole("complementary", { name: "剧集结构" });
    expect(within(rail).getByRole("combobox", { name: "选择季" })).toHaveValue("s32");
    expect(within(rail).getByRole("spinbutton", { name: /跳到集号/ })).toBeInTheDocument();
    expect(within(rail).getByRole("button", { name: /新增第 1,169 集/ })).toBeInTheDocument();
    expect(within(rail).getByText("32 季 · 1,478 集")).toBeInTheDocument();
  });
});
