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
    await user.click(screen.getByRole("button", { name: "上移Doe, Jane" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("Doe, Jane\n张三");
    await user.click(screen.getByRole("button", { name: "移除关联：张三" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("Doe, Jane");
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
});
