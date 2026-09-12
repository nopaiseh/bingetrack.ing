import { render, screen } from "@testing-library/react";
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
