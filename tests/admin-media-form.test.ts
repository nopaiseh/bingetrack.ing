import { describe, expect, it } from "vitest";
import { coverUrlForSave, parseMediaForm } from "@/lib/admin/media-form";

/** 生成有效的最小媒体表单，可覆盖字段以验证边界。 */
function form(values: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ type: "movie", title: "测试电影", status: "want_to_watch", ...values }))
    result.set(key, value);
  return result;
}

describe("管理媒体输入", () => {
  it("没有评分即没看过，空白评分和时长保持 null", () => {
    expect(parseMediaForm(form())).toMatchObject({ status: "want_to_watch", rating: null, runtime: null });
  });
  it("填写评分即看过，0 分也算已评分", () => {
    expect(parseMediaForm(form({ rating: "0" }))).toMatchObject({ status: "watched", rating: 0 });
    expect(
      parseMediaForm(
        form({ type: "tv_episode", parent_id: "11111111-1111-4111-8111-111111111111", number: "1", rating: "8.5" }),
      ),
    ).toMatchObject({ status: "watched", rating: 8.5 });
  });
  it.each(["watched", "watching", "", "finished"])("忽略提交的观看状态 %s，只看评分", (status) => {
    expect(parseMediaForm(form({ status })).status).toBe("want_to_watch");
    expect(parseMediaForm(form({ status, rating: "7" })).status).toBe("watched");
  });
  it.each(["NaN", "Infinity", "-1", "10.1", "5.55"])("拒绝不合法评分 %s", (rating) => {
    expect(() => parseMediaForm(form({ rating }))).toThrow();
  });
  it("逐行处理名称且保留名字中的逗号", () => {
    expect(parseMediaForm(form({ actors: "\tDoe, Jane\n\t张三\n\t张三\n" })).actors).toEqual([
      { id: null, name: "Doe, Jane", character: null },
      { id: null, name: "张三", character: null },
    ]);
  });
  it("演员行以制表符分隔饰演角色，空角色为 null，同名演员保留第一行", () => {
    expect(
      parseMediaForm(form({ actors: "\t迈克·梅尔斯\t奥斯汀 / 邪恶博士\n\t张三\t \n\t迈克·梅尔斯\t别的角色" })).actors,
    ).toEqual([
      { id: null, name: "迈克·梅尔斯", character: "奥斯汀 / 邪恶博士" },
      { id: null, name: "张三", character: null },
    ]);
  });
  it("同名人物凭 ID 区分，同一 ID 只保留第一行", () => {
    const first = "00000000-0000-4000-8000-000000000001";
    const second = "00000000-0000-4000-8000-000000000002";
    const result = parseMediaForm(
      form({
        actors: `${first}\t张伟\t甲\n${second}\t张伟\t乙\n${first}\t张伟\t丙`,
        directors: `${first}\t张伟\n\t张伟`,
      }),
    );
    expect(result.actors).toEqual([
      { id: first, name: "张伟", character: "甲" },
      { id: second, name: "张伟", character: "乙" },
    ]);
    expect(result.directors).toEqual([
      { id: first, name: "张伟" },
      { id: null, name: "张伟" },
    ]);
  });
  it("拒绝格式错误的人物 ID", () => {
    expect(() => parseMediaForm(form({ actors: "not-a-uuid\t张三" }))).toThrow();
  });
  it("拒绝过长的角色名", () => {
    expect(() => parseMediaForm(form({ actors: `\t张三\t${"角".repeat(201)}` }))).toThrow();
  });
  it.each([
    "javascript:alert(1)",
    "https://image.tmdb.org.evil.test/a",
    "https://user@image.tmdb.org/a",
    "http://image.tmdb.org/t/p/a.jpg",
    "https://tmdb.org/t/p/a.jpg",
    "https://media.tmdb.org/t/p/a.jpg",
    "https://image.tmdb.org/a.jpg",
  ])("拒绝不受支持的封面地址 %s", (cover_url) => {
    expect(() => parseMediaForm(form({ cover_url }))).toThrow();
  });
  it("接受 TMDB HTTPS 封面", () => {
    expect(parseMediaForm(form({ cover_url: "https://image.tmdb.org/t/p/w500/a.jpg" })).cover_url).toContain(
      "image.tmdb.org",
    );
  });
  it("新建和更新季时丢掉封面，其他类型保留", () => {
    const cover = "https://image.tmdb.org/t/p/original/poster.jpg";
    const parent = "11111111-1111-4111-8111-111111111111";
    const id = "22222222-2222-4222-8222-222222222222";
    const season = { type: "tv_season", title: "第 1 季", parent_id: parent, number: "1", cover_url: cover };
    expect(parseMediaForm(form(season)).cover_url).toBeNull();
    expect(parseMediaForm(form({ ...season, id })).cover_url).toBeNull();
    expect(parseMediaForm(form({ ...season, cover_url: "not a url" })).cover_url).toBeNull();
    expect(parseMediaForm(form({ ...season, cover_url: "x".repeat(2001) })).cover_url).toBeNull();
    expect(coverUrlForSave("tv_season", cover)).toBeNull();

    expect(parseMediaForm(form({ cover_url: cover })).cover_url).toBe(cover);
    expect(parseMediaForm(form({ id, cover_url: cover })).cover_url).toBe(cover);
    expect(parseMediaForm(form({ type: "tv_show", title: "测试剧集", cover_url: cover })).cover_url).toBe(cover);
    expect(parseMediaForm(form({ id, type: "tv_show", title: "测试剧集", cover_url: cover })).cover_url).toBe(cover);
    const episode = { type: "tv_episode", title: "第 1 集", parent_id: parent, number: "1", cover_url: cover };
    expect(parseMediaForm(form(episode)).cover_url).toBe(cover);
    expect(parseMediaForm(form({ ...episode, id })).cover_url).toBe(cover);
    expect(coverUrlForSave("movie", cover)).toBe(cover);
    expect(coverUrlForSave("tv_show", cover)).toBe(cover);
    expect(coverUrlForSave("tv_episode", null)).toBeNull();
  });
  it("拒绝无效日期和无上级关系的集", () => {
    expect(() => parseMediaForm(form({ release_date: "2026-02-30" }))).toThrow();
    expect(() => parseMediaForm(form({ type: "tv_episode", number: "1" }))).toThrow();
    expect(() => parseMediaForm(form({ type: "tv_episode", parent_id: "null", number: "1" }))).toThrow();
  });
  it("允许特别篇编号为零", () => {
    expect(
      parseMediaForm(form({ type: "tv_season", parent_id: "11111111-1111-4111-8111-111111111111", number: "0" }))
        .number,
    ).toBe(0);
  });
  it("电视节目与季无需提供状态、评分、发行日期与时长，始终重置为安全默认值", () => {
    const seriesResult = parseMediaForm(
      form({
        type: "tv_show",
        title: "测试剧集",
        status: "",
        rating: "9.5",
        release_date: "2024-01-01",
        runtime: "60",
      }),
    );
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
  it("解析专辑与曲目字段，时长按秒，封面接受音乐主机", () => {
    const albumId = "11111111-1111-4111-8111-111111111111";
    const album = parseMediaForm(
      form({
        type: "album",
        title: "测试专辑",
        release_date: "2024-01-01",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg",
        artists: "\t歌手甲\n\t歌手乙",
        genres: "流行",
        label: "测试厂牌",
        rating: "9",
        runtime: "40",
      }),
    );
    expect(album).toMatchObject({
      type: "album",
      release_date: "2024-01-01",
      rating: null,
      runtime: null,
      label: "测试厂牌",
      artists: [
        { id: null, name: "歌手甲" },
        { id: null, name: "歌手乙" },
      ],
      genres: ["流行"],
      actors: [],
      directors: [],
    });
    expect(album.cover_url).toContain("mzstatic.com");

    const track = parseMediaForm(
      form({
        type: "music",
        title: "测试曲目",
        parent_id: albumId,
        number: "3",
        runtime: "215",
        rating: "8.5",
        cover_url: "https://coverartarchive.org/release/abc/front-500",
        artists: "\t主唱",
        lyricists: "\t作词人",
        composers: "\t作曲人",
        genres: "流行",
      }),
    );
    expect(track).toMatchObject({
      type: "music",
      parent_id: albumId,
      number: 3,
      runtime: 215,
      status: "watched",
      rating: 8.5,
      genres: [],
      artists: [{ id: null, name: "主唱" }],
      lyricists: [{ id: null, name: "作词人" }],
      composers: [{ id: null, name: "作曲人" }],
    });
    expect(() => parseMediaForm(form({ type: "music", title: "无上级", number: "1" }))).toThrow(/所属专辑/);
    expect(() =>
      parseMediaForm(
        form({
          type: "album",
          title: "坏封面",
          cover_url: "https://evil.example/cover.jpg",
        }),
      ),
    ).toThrow(/封面/);
  });

  it("季和单集条目强制清空所有关联资料", () => {
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
    expect(movieResult.actors).toEqual([{ id: null, name: "演员一", character: null }]);
  });
});
