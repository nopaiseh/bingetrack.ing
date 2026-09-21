import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import MediaForm from "@/app/manage/media/MediaForm";
import ReferenceForm from "@/app/manage/references/ReferenceForm";
vi.mock("@/app/manage/actions", () => ({ saveMedia: vi.fn(async () => ({ error: "保存失败，请重试。" })), deleteMedia: vi.fn() }));
vi.mock("@/app/manage/reference-actions", () => ({ saveReference: vi.fn(async () => ({ error: "名称已经存在。" })), deleteReference: vi.fn(), searchChoices: vi.fn() }));

it("媒体保存失败后保留已填写资料与未保存提示", async () => {
  const user = userEvent.setup();
  render(<MediaForm />);
  await user.type(screen.getByLabelText("标题", { exact: true }), "不能丢失的标题");
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("保存失败");
  expect(screen.getByLabelText("标题", { exact: true })).toHaveValue("不能丢失的标题");
  expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
});
it("关联资料命名冲突后保留用户输入", async () => {
  const user = userEvent.setup();
  render(<ReferenceForm kind="genres" />);
  await user.type(screen.getByLabelText("名称", { exact: true }), "剧情");
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("名称已经存在");
  expect(screen.getByLabelText("名称", { exact: true })).toHaveValue("剧情");
});

it("电影和剧集显示可编辑观看状态，电视剧和剧季显示只读说明", () => {
  const { unmount } = render(<MediaForm initialType="movie" />);
  expect(screen.getByLabelText("观看状态")).toBeInTheDocument();
  expect(screen.getByLabelText(/评分/)).toBeInTheDocument();

  // 切换为电视剧
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_series" } });
  expect(screen.queryByRole("combobox", { name: "观看状态" })).not.toBeInTheDocument();
  expect(screen.getByText(/电视剧的观看状态由下属剧集自动汇总决定/)).toBeInTheDocument();

  // 切换为剧季
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_season" } });
  expect(screen.queryByRole("combobox", { name: "观看状态" })).not.toBeInTheDocument();
  expect(screen.getByText(/剧季的观看状态由下属剧集自动汇总决定/)).toBeInTheDocument();

  // 切换为剧集
  fireEvent.change(screen.getByLabelText("类型"), { target: { value: "tv_episode" } });
  expect(screen.getByLabelText("观看状态")).toBeInTheDocument();
  expect(screen.getByLabelText(/评分/)).toBeInTheDocument();
  unmount();

  render(<MediaForm initialType="tv_series" />);
  expect(screen.queryByRole("combobox", { name: "观看状态" })).not.toBeInTheDocument();
  expect(screen.getByText(/电视剧的观看状态由下属剧集自动汇总决定/)).toBeInTheDocument();
});

it("lockType 为真时锁定媒体类型，不展示分段切换控件", () => {
  render(<MediaForm initialType="tv_episode" lockType={true} />);
  expect(screen.queryByRole("tablist", { name: "媒体类型快捷选择" })).not.toBeInTheDocument();
  expect(screen.getByText("媒体类型")).toBeInTheDocument();
  expect(screen.getByText("剧集")).toBeInTheDocument();
});

it("电影和电视剧展示关联资料，剧季和剧集不展示关联资料", () => {
  const { unmount: unmount1 } = render(<MediaForm initialType="movie" />);
  expect(screen.getByText("关联资料")).toBeInTheDocument();
  unmount1();

  const { unmount: unmount2 } = render(<MediaForm initialType="tv_series" />);
  expect(screen.getByText("关联资料")).toBeInTheDocument();
  unmount2();

  const { unmount: unmount3 } = render(<MediaForm initialType="tv_season" />);
  expect(screen.queryByText("关联资料")).not.toBeInTheDocument();
  unmount3();

  render(<MediaForm initialType="tv_episode" />);
  expect(screen.queryByText("关联资料")).not.toBeInTheDocument();
});
