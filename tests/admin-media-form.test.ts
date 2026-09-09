import { describe, expect, it } from "vitest";
import { parseMediaForm } from "@/lib/admin/media-form";

/** 生成有效的最小媒体表单，可覆盖字段以验证边界。 */
function form(values: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ type: "movie", title: "测试电影", status: "want_to_watch", ...values })) result.set(key, value);
  return result;
}

describe("管理媒体输入", () => {
  it("只使用看过或没看过，空白评分和时长保持 null", () => {
    expect(parseMediaForm(form())).toMatchObject({ status: "want_to_watch", rating: null, runtime: null });
    expect(parseMediaForm(form({ status: "watched", rating: "0" })).rating).toBe(0);
  });
  it.each(["watching", "", "finished"])("拒绝额外观看状态 %s", status => {
    expect(() => parseMediaForm(form({ status }))).toThrow();
  });
  it.each(["NaN", "Infinity", "-1", "10.1", "5.55"])("拒绝不合法评分 %s", rating => {
    expect(() => parseMediaForm(form({ rating }))).toThrow();
  });
  it("逐行处理名称且保留名字中的逗号", () => {
    expect(parseMediaForm(form({ actors: "Doe, Jane\n张三\n张三\n" })).actors).toEqual(["Doe, Jane", "张三"]);
  });
  it.each(["javascript:alert(1)", "https://image.tmdb.org.evil.test/a", "https://user@image.tmdb.org/a", "http://image.tmdb.org/a"])("拒绝不受支持的封面地址 %s", cover_url => {
    expect(() => parseMediaForm(form({ cover_url }))).toThrow();
  });
  it("接受 TMDB HTTPS 封面", () => {
    expect(parseMediaForm(form({ cover_url: "https://image.tmdb.org/t/p/w500/a.jpg" })).cover_url).toContain("image.tmdb.org");
  });
  it("拒绝无效日期和无上级关系的集", () => {
    expect(() => parseMediaForm(form({ release_date: "2026-02-30" }))).toThrow();
    expect(() => parseMediaForm(form({ type: "tv_episode", number: "1" }))).toThrow();
    expect(() => parseMediaForm(form({ type: "tv_episode", parent_id: "null", number: "1" }))).toThrow();
  });
  it("允许特别篇编号为零", () => {
    expect(parseMediaForm(form({ type: "tv_season", parent_id: "11111111-1111-4111-8111-111111111111", number: "0" })).number).toBe(0);
  });
});
