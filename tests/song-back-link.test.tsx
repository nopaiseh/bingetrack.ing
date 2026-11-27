import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

import SongBackLink from "@/components/SongBackLink";

const songId = "50000000-0000-4000-8000-000000000021";
const personId = "40000000-0000-4000-8000-000000000004";
const albumId = "50000000-0000-4000-8000-000000000020";

describe("SongBackLink from 参数", () => {
  it.each([
    ["/search", "返回搜索页"],
    ["/search?type=music", "返回搜索页"],
    [`/albums/${albumId}`, "返回专辑"],
    [`/albums/${albumId}?from=%2Fsearch`, "返回专辑"],
    [`/music/${songId}`, "返回歌曲"],
    ["/music", "返回歌曲"],
    [`/people/${personId}`, "返回人物"],
    ["/people", "返回人物"],
  ])("合法站内 from=%s → %s", (from, label) => {
    navigation.search = `?from=${encodeURIComponent(from)}`;
    render(<SongBackLink />);
    expect(screen.getByRole("link", { name: new RegExp(label) })).toHaveAttribute("href", from);
  });

  it.each([
    ["外部绝对地址", "https://evil.example/music/x"],
    ["协议相对地址", "//evil.example/music/x"],
    ["伪装前缀", "/musician"],
    ["伪装人物前缀", "/peoples"],
    ["javascript 伪协议", "javascript:alert(1)"],
    ["空字符串", ""],
    ["非允许路径", "/movies/x"],
  ])("非法或外部 from（%s）回退音乐列表", (_label, from) => {
    navigation.search = from === "" ? "?from=" : `?from=${encodeURIComponent(from)}`;
    render(<SongBackLink />);
    expect(screen.getByRole("link", { name: /返回音乐列表/ })).toHaveAttribute("href", "/albums");
  });

  it("缺少 from 时回退音乐列表", () => {
    navigation.search = "";
    render(<SongBackLink />);
    expect(screen.getByRole("link", { name: /返回音乐列表/ })).toHaveAttribute("href", "/albums");
  });
});
