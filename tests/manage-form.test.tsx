import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import MediaForm from "@/app/(admin)/manage/media/MediaForm";
import ReferenceForm from "@/app/(admin)/manage/references/ReferenceForm";
vi.mock("@/app/(admin)/manage/actions", () => ({ saveMedia: vi.fn(async () => ({ error: "保存失败，请重试。" })), deleteMedia: vi.fn() }));
vi.mock("@/app/(admin)/manage/reference-actions", () => ({ saveReference: vi.fn(async () => ({ error: "名称已经存在。" })), deleteReference: vi.fn(), searchChoices: vi.fn() }));

it("媒体保存失败后保留已填写资料与未保存提示", async () => {
  const user = userEvent.setup();
  render(<MediaForm />);
  await user.type(screen.getByLabelText("中文标题", { exact: true }), "不能丢失的标题");
  await user.click(screen.getByRole("button", { name: "保存" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("保存失败");
  expect(screen.getByLabelText("中文标题", { exact: true })).toHaveValue("不能丢失的标题");
  expect(screen.getByText("有未保存的更改")).toBeInTheDocument();
});
it("关联资料命名冲突后保留用户输入", async () => {
  const user = userEvent.setup();
  render(<ReferenceForm kind="genres" />);
  await user.type(screen.getByLabelText("名称", { exact: true }), "剧情");
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("名称已经存在");
  expect(screen.getByLabelText("名称", { exact: true })).toHaveValue("剧情");
});

it("电影和单集由评分决定观看状态，电视节目和季显示只读说明", () => {
  const { unmount } = render(<MediaForm initialType="movie" />);
  expect(screen.queryByRole("combobox", { name: "观看状态" })).not.toBeInTheDocument();
  const rating = screen.getByLabelText(/评分/);
  expect(rating).toHaveAccessibleDescription(/没看过.*填写评分即标为看过/);
  fireEvent.change(rating, { target: { value: "0" } });
  expect(rating).toHaveAccessibleDescription(/看过.*已评分，保存为看过/);
  fireEvent.change(rating, { target: { value: "" } });

  // 切换为电视节目
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_show" } });
  expect(screen.queryByRole("combobox", { name: "观看状态" })).not.toBeInTheDocument();
  expect(screen.getByText(/电视节目的观看状态由下属单集自动汇总决定/)).toBeInTheDocument();

  // 切换为季
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_season" } });
  expect(screen.queryByRole("combobox", { name: "观看状态" })).not.toBeInTheDocument();
  expect(screen.getByText(/季的观看状态由下属单集自动汇总决定/)).toBeInTheDocument();

  // 切换为单集
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_episode" } });
  expect(screen.queryByRole("combobox", { name: "观看状态" })).not.toBeInTheDocument();
  expect(screen.getByLabelText(/评分/)).toBeInTheDocument();
  unmount();

  render(<MediaForm initialType="tv_show" />);
  expect(screen.queryByRole("combobox", { name: "观看状态" })).not.toBeInTheDocument();
  expect(screen.getByText(/电视节目的观看状态由下属单集自动汇总决定/)).toBeInTheDocument();
});

it("单集不提供封面地址，电影和电视节目仍保留，已有剧照在保存时原样带回", () => {
  const { container, unmount } = render(<MediaForm initialType="movie" />);
  const cover = screen.getByLabelText("TMDB 海报路径");
  fireEvent.change(cover, { target: { value: "https://image.tmdb.org/t/p/w500/poster.jpg" } });
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_episode" } });
  expect(screen.queryByLabelText("TMDB 海报路径")).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText("https://image.tmdb.org/t/p/original/…")).not.toBeInTheDocument();
  expect(container.querySelector('input[name="cover_url"]')).toHaveValue("");
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_show" } });
  expect(screen.getByLabelText("TMDB 海报路径")).toHaveValue("https://image.tmdb.org/t/p/w500/poster.jpg");
  unmount();

  const episode = render(<MediaForm initialType="tv_episode" lockType item={{
    id: "ep-1", type: "tv_episode", title: "启程", alternate_title: null, summary: null,
    cover_url: "https://image.tmdb.org/t/p/w500/still.jpg", release_date: "2024-01-01", runtime: 40,
    parent_id: "season-1", number: 1, status: "want_to_watch", rating: null,
    genres: [], languages: [], regions: [], actors: [], directors: [],
  }} />);
  expect(screen.queryByLabelText(/封面/)).not.toBeInTheDocument();
  expect(episode.container.querySelector('input[name="cover_url"]')).toHaveAttribute("type", "hidden");
  expect(episode.container.querySelector('input[name="cover_url"]')).toHaveValue("https://image.tmdb.org/t/p/w500/still.jpg");
});

it("lockType 为真时锁定媒体类型，不展示分段切换控件", () => {
  render(<MediaForm initialType="tv_episode" lockType={true} />);
  expect(screen.queryByRole("tablist", { name: "媒体类型快捷选择" })).not.toBeInTheDocument();
  expect(screen.getByText("媒体类型")).toBeInTheDocument();
  expect(screen.getAllByText("单集").length).toBeGreaterThan(0);
});

it("海报预览只使用 TMDB 文件名，不把输入原文当成图片地址", () => {
  const { container } = render(<MediaForm initialType="movie" />);
  const cover = screen.getByLabelText("TMDB 海报路径");
  fireEvent.change(cover, { target: { value: "javascript:alert(1)" } });
  expect(container.querySelector("img")).toBeNull();
  fireEvent.change(cover, { target: { value: "https://image.tmdb.org/t/p/w500/poster.jpg" } });
  expect(container.querySelector("img")).toHaveAttribute("src", "https://image.tmdb.org/t/p/w500/poster.jpg");
  expect(cover).toHaveValue("https://image.tmdb.org/t/p/w500/poster.jpg");
});

it("电影和电视节目展示演职员与海报，季保留海报，单集只有文字", () => {
  const { unmount: unmount1 } = render(<MediaForm initialType="movie" />);
  expect(screen.getByRole("heading", { name: "演职员" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "海报与图片" })).toBeInTheDocument();
  unmount1();

  const { unmount: unmount2 } = render(<MediaForm initialType="tv_show" />);
  expect(screen.getByRole("heading", { name: "演职员" })).toBeInTheDocument();
  unmount2();

  const { unmount: unmount3 } = render(<MediaForm initialType="tv_season" />);
  expect(screen.queryByRole("heading", { name: "演职员" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "海报与图片" })).toBeInTheDocument();
  unmount3();

  render(<MediaForm initialType="tv_episode" />);
  expect(screen.queryByRole("heading", { name: "演职员" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "海报与图片" })).not.toBeInTheDocument();
  expect(screen.getByText(/单集只填文字资料/)).toBeInTheDocument();
});

it("季和单集编号输入框拥有正确无歧义的无障碍标签", () => {
  const { unmount } = render(<MediaForm initialType="tv_season" />);
  expect(screen.getByLabelText("季编号（特别篇可填 0）")).toBeInTheDocument();
  unmount();

  render(<MediaForm initialType="tv_episode" />);
  expect(screen.getByLabelText("集编号", { exact: true })).toBeInTheDocument();
});

it("电影和单集显示日期和片长，电视节目和季不显示，日期按 YYYY-MM-DD 填写", () => {
  const { unmount } = render(<MediaForm initialType="movie" item={{
    id: "mv-1", type: "movie", title: "毁灭之日", alternate_title: null, summary: null,
    cover_url: null, release_date: "2026-12-18", runtime: 165,
    parent_id: null, number: null, status: "want_to_watch", rating: null,
    genres: [], languages: [], regions: [], actors: [], directors: [],
  }} />);
  const date = screen.getByLabelText("上映日期");
  expect(date).toHaveValue("2026-12-18");
  expect(date).toHaveAttribute("placeholder", "YYYY-MM-DD");
  expect(screen.getByLabelText("片长")).toHaveValue(165);

  unmount();
  render(<MediaForm initialType="movie" />);
  expect(screen.getByLabelText("上映日期")).toBeInTheDocument();
  expect(screen.getByLabelText("片长")).toBeInTheDocument();

  // 切换为电视节目
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_show" } });
  expect(screen.queryByLabelText("上映日期")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("播出日期")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("片长")).not.toBeInTheDocument();

  // 切换为季
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_season" } });
  expect(screen.queryByLabelText("上映日期")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("片长")).not.toBeInTheDocument();

  // 切换为单集
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_episode" } });
  expect(screen.getByLabelText("播出日期")).toBeInTheDocument();
  expect(screen.getByLabelText("片长")).toBeInTheDocument();
});

