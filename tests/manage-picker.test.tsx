import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChoicePicker from "@/app/(admin)/manage/ChoicePicker";
import { searchChoices } from "@/app/(admin)/manage/reference-actions";
vi.mock("@/app/(admin)/manage/reference-actions", () => ({ searchChoices: vi.fn() }));
beforeEach(() => { vi.mocked(searchChoices).mockResolvedValue({ choices: [{ id: "person-1", name: "Doe, Jane" }] }); });
describe("管理关联选择器", () => {
  it("选择、排序与移除只改变当前表单的关联字段", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChoicePicker kind="people" name="actors" label="演员" initial={[{ id: "a", name: "张三" }]} allowCreate />);
    await user.click(screen.getByRole("combobox", { name: "演员" }));
    await user.click(await screen.findByRole("option", { name: "Doe, Jane" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("a\t张三\nperson-1\tDoe, Jane");
    // 测试上移
    await user.click(screen.getByRole("button", { name: "上移Doe, Jane" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("person-1\tDoe, Jane\na\t张三");
    // 测试下移
    await user.click(screen.getByRole("button", { name: "下移Doe, Jane" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("a\t张三\nperson-1\tDoe, Jane");
    await user.click(screen.getByRole("button", { name: "移除关联：张三" }));
    expect(container.querySelector('input[name="actors"]')).toHaveValue("person-1\tDoe, Jane");
  });
  it("演员以「ID<Tab>姓名<Tab>角色」提交，新建人物 ID 留空，角色中的制表符被替换为空格", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChoicePicker kind="people" name="actors" label="演员" withCharacter initial={[{ id: "a", name: "张三", character: "李四" }, { id: "new:王五", name: "王五" }]} allowCreate />);
    const hidden = () => container.querySelector('input[name="actors"]');
    expect(hidden()).toHaveValue("a\t张三\t李四\n\t王五");
    await user.type(screen.getByRole("textbox", { name: "王五饰演的角色" }), "赵六");
    expect(hidden()).toHaveValue("a\t张三\t李四\n\t王五\t赵六");
    fireEvent.change(screen.getByRole("textbox", { name: "张三饰演的角色" }), { target: { value: "甲\t乙" } });
    expect(hidden()).toHaveValue("a\t张三\t甲 乙\n\t王五\t赵六");
    await user.clear(screen.getByRole("textbox", { name: "张三饰演的角色" }));
    expect(hidden()).toHaveValue("a\t张三\n\t王五\t赵六");
  });
  it("同名人物按 ID 区分并显示别名，已有无别名同名者时不再提供新增", async () => {
    const user = userEvent.setup();
    vi.mocked(searchChoices).mockResolvedValue({ choices: [{ id: "p1", name: "张伟" }, { id: "p2", name: "张伟", detail: "歌手" }] });
    const { container } = render(<ChoicePicker kind="people" name="directors" label="导演" initial={[{ id: "p2", name: "张伟", detail: "歌手" }]} allowCreate />);
    await user.type(screen.getByRole("combobox", { name: "导演" }), "张伟");
    const option = await screen.findByRole("option", { name: "张伟" });
    expect(screen.queryByRole("option", { name: /新增并关联/ })).not.toBeInTheDocument();
    await user.click(option);
    expect(container.querySelector('input[name="directors"]')).toHaveValue("p2\t张伟\np1\t张伟");
    expect(screen.getByText("(歌手)")).toBeInTheDocument();
  });
  it("上下键在候选项与新增项之间定位，回车选择当前项", async () => {
    const user = userEvent.setup();
    vi.mocked(searchChoices).mockResolvedValue({ choices: [{ id: "g1", name: "喜剧片" }, { id: "g2", name: "喜剧动画" }] });
    const { container } = render(<ChoicePicker kind="genres" name="genres" label="类型" allowCreate />);
    const box = screen.getByRole("combobox", { name: "类型" });
    await user.type(box, "喜剧");
    // 搜索结果返回前回车不选择任何项，避免误建新名称。
    await user.keyboard("{Enter}");
    expect(container.querySelector('input[name="genres"]')).toHaveValue("");
    const first = await screen.findByRole("option", { name: "喜剧片" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(box).toHaveAttribute("aria-activedescendant", first.id);
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "新增并关联「喜剧」" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}{Enter}");
    expect(container.querySelector('input[name="genres"]')).toHaveValue("喜剧动画");
    expect(box).toHaveAttribute("aria-expanded", "false");
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
    const { container } = render(<ChoicePicker kind="tv_show" name="parent_id" label="所属电视节目" multiple={false} />);
    await user.type(screen.getByRole("combobox"), "随意文字");
    expect(container.querySelector('input[name="parent_id"]')).toHaveValue("");
    expect(screen.queryByRole("option", { name: /新增并关联/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "Doe, Jane" }));
    expect(container.querySelector('input[name="parent_id"]')).toHaveValue("person-1");
  });
  it("失败搜索显示错误，并允许再次搜索恢复", async () => {
    vi.mocked(searchChoices).mockRejectedValueOnce(new Error("network"));
    render(<ChoicePicker kind="genres" name="genres" label="类型" />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(await screen.findByRole("alert")).toHaveTextContent("搜索失败");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "新查询" } });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Doe, Jane" })).toBeInTheDocument();
  });
  it("单选模式下展示紧凑卡片，点击更换可重新搜索", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ChoicePicker kind="tv_show" name="parent_id" label="所属电视节目" multiple={false} required initial={[{ id: "s-1", name: "原剧集" }]} />
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
