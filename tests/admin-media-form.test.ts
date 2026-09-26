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
    expect(parseMediaForm(form({ actors: "Doe, Jane\n张三\n张三\n" })).actors).toEqual([{ name: "Doe, Jane", character: null }, { name: "张三", character: null }]);
  });
  it("演员行以制表符分隔饰演角色，空角色为 null，同名演员保留第一行", () => {
    expect(parseMediaForm(form({ actors: "迈克·梅尔斯\t奥斯汀 / 邪恶博士\n张三\t \n迈克·梅尔斯\t别的角色" })).actors).toEqual([
      { name: "迈克·梅尔斯", character: "奥斯汀 / 邪恶博士" },
      { name: "张三", character: null },
    ]);
  });
  it("拒绝过长的角色名", () => {
    expect(() => parseMediaForm(form({ actors: `张三\t${"角".repeat(201)}` }))).toThrow();
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
  it("电视剧与剧季无需提供状态、评分、发行日期与时长，始终重置为安全默认值", () => {
    const seriesResult = parseMediaForm(form({ type: "tv_series", title: "测试剧集", status: "", rating: "9.5", release_date: "2024-01-01", runtime: "60" }));
    expect(seriesResult.status).toBe("want_to_watch");
    expect(seriesResult.rating).toBeNull();
    expect(seriesResult.release_date).toBeNull();
    expect(seriesResult.runtime).toBeNull();

    const seasonForm = new FormData();
    seasonForm.set("type", "tv_season");
    seasonForm.set("title", "第 1 季");
    seasonForm.set("parent_id", "11111111-1111-4111-8111-111111111111");
    seasonForm.set("number", "1");
    seasonForm.set("release_date", "2024-02-01");
    seasonForm.set("runtime", "45");
    const seasonResult = parseMediaForm(seasonForm);
    expect(seasonResult.status).toBe("want_to_watch");
    expect(seasonResult.rating).toBeNull();
    expect(seasonResult.release_date).toBeNull();
    expect(seasonResult.runtime).toBeNull();
  });
  it("剧季和剧集条目强制清空所有关联资料", () => {
    const parentId = "11111111-1111-4111-8111-111111111111";
    const seasonForm = form({
      type: "tv_season",
      title: "第 1 季",
      parent_id: parentId,
      number: "1",
      genres: "动作\n剧情",
      languages: "英语",
      regions: "美国",
      actors: "演员一",
      directors: "导演一",
      collections: "系列一",
    });
    const seasonResult = parseMediaForm(seasonForm);
    expect(seasonResult.genres).toEqual([]);
    expect(seasonResult.languages).toEqual([]);
    expect(seasonResult.regions).toEqual([]);
    expect(seasonResult.actors).toEqual([]);
    expect(seasonResult.directors).toEqual([]);
    expect(seasonResult.collections).toEqual([]);

    const episodeForm = form({
      type: "tv_episode",
      title: "第 1 集",
      parent_id: parentId,
      number: "1",
      genres: "动作",
      actors: "演员一",
    });
    const episodeResult = parseMediaForm(episodeForm);
    expect(episodeResult.genres).toEqual([]);
    expect(episodeResult.actors).toEqual([]);

    const movieForm = form({
      type: "movie",
      genres: "动作\n剧情",
      actors: "演员一",
    });
    const movieResult = parseMediaForm(movieForm);
    expect(movieResult.genres).toEqual(["动作", "剧情"]);
    expect(movieResult.actors).toEqual([{ name: "演员一", character: null }]);
  });
});
