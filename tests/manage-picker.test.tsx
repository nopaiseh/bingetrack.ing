import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChoicePicker from "@/app/manage/ChoicePicker";
import { searchChoices } from "@/app/manage/reference-actions";
vi.mock("@/app/manage/reference-actions", () => ({ searchChoices: vi.fn() }));
beforeEach(() => { vi.mocked(searchChoices).mockResolvedValue({ choices: [{ id: "person-1", name: "Doe, Jane" }] }); });
describe("管理关联选择器", () => {
  it("选择、排序与移除只改变当前表单的关联字段", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChoicePicker kind="people" name="actors" label="演员" initial={[{ id: "a", name: "张三" }]} allowCreate />);
    await user.click(screen.getByRole("combobox", { name: "演员" }));
    await user.click(await screen.findByRole("button", { name: "Doe, Jane" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("张三\nDoe, Jane");
    // 测试上移
    await user.click(screen.getByRole("button", { name: "上移Doe, Jane" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("Doe, Jane\n张三");
    // 测试下移
    await user.click(screen.getByRole("button", { name: "下移Doe, Jane" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("张三\nDoe, Jane");
    await user.click(screen.getByRole("button", { name: "移除关联：张三" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("Doe, Jane");
  });
  it("非排序字段（如类型）不展示排序箭头与番位徽标", () => {
    render(<ChoicePicker kind="genres" name="genres" label="类型标签" initial={[{ id: "g1", name: "综艺" }, { id: "g2", name: "竞技" }]} />);
    expect(screen.getByText("综艺")).toBeInTheDocument();
    expect(screen.getByText("竞技")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /上移/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /下移/ })).not.toBeInTheDocument();
    expect(screen.queryByText("#1")).not.toBeInTheDocument();
  });
  it("父级只接受搜索结果的 ID，不能把输入文本当成上级", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChoicePicker kind="tv_series" name="parent_id" label="所属电视剧" multiple={false} />);
    await user.type(screen.getByRole("combobox"), "随意文字");
    expect(container.querySelector('input[name="parent_id"]')).toHaveValue("");
    expect(screen.queryByRole("button", { name: /新增并关联/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Doe, Jane" }));
    expect(container.querySelector('input[name="parent_id"]')).toHaveValue("person-1");
  });
  it("失败搜索显示错误，并允许再次搜索恢复", async () => {
    vi.mocked(searchChoices).mockRejectedValueOnce(new Error("network"));
    render(<ChoicePicker kind="genres" name="genres" label="类型" />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(await screen.findByRole("alert")).toHaveTextContent("搜索失败");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "新查询" } });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Doe, Jane" })).toBeInTheDocument();
  });
  it("单选模式下展示紧凑卡片，点击更换可重新搜索", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ChoicePicker kind="tv_series" name="parent_id" label="所属电视剧" multiple={false} required initial={[{ id: "s-1", name: "原剧集" }]} />
    );
    expect(screen.getByText("必填")).toBeInTheDocument();
    expect(screen.getByText("原剧集")).toBeInTheDocument();
    expect(container.querySelector('input[name="parent_id"]')).toHaveValue("s-1");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /更换/ }));
    expect(container.querySelector('input[name="parent_id"]')).toHaveValue("");
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
