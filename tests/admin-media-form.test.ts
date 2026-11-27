import { describe, expect, it } from "vitest";
import { coverUrlForSave, MAX_CREDITS, MAX_CREDIT_FIELD, MAX_NAMES, parseMediaForm } from "@/lib/admin/media-form";

/** 生成有效的最小媒体表单，可覆盖字段以验证边界。 */
function form(values: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ type: "movie", title: "测试电影", status: "want_to_watch", ...values }))
    result.set(key, value);
  return result;
}

/** 生成 N 行「\\t姓名」演员表文本。 */
function actorLines(count: number) {
  return Array.from({ length: count }, (_, i) => `\t演员${i + 1}`).join("\n");
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
  it("拒绝过长的角色名，并指出原始行号", () => {
    expect(() => parseMediaForm(form({ actors: `\t张三\t${"角".repeat(MAX_CREDIT_FIELD + 1)}` }))).toThrow(
      `演员表第 1 行角色超过 ${MAX_CREDIT_FIELD} 字。`,
    );
  });
  it(`接受恰好 ${MAX_CREDITS} 名演员`, () => {
    expect(parseMediaForm(form({ actors: actorLines(MAX_CREDITS) })).actors).toHaveLength(MAX_CREDITS);
  });
  it(`拒绝超过 ${MAX_CREDITS} 名演员，并报告当前人数`, () => {
    expect(() => parseMediaForm(form({ actors: actorLines(MAX_CREDITS + 1) }))).toThrow(
      `演员最多 ${MAX_CREDITS} 人，当前 ${MAX_CREDITS + 1} 人。`,
    );
  });
  it("超长姓名报错带原始行号", () => {
    const actors = `\t甲\n\t${"名".repeat(MAX_CREDIT_FIELD + 1)}\n\t乙`;
    expect(() => parseMediaForm(form({ actors }))).toThrow(`演员表第 2 行姓名超过 ${MAX_CREDIT_FIELD} 字。`);
  });
  it(`names 仍限 ${MAX_NAMES} 个`, () => {
    const genres = Array.from({ length: MAX_NAMES }, (_, i) => `类型${i + 1}`).join("\n");
    expect(parseMediaForm(form({ genres })).genres).toHaveLength(MAX_NAMES);
    expect(() => parseMediaForm(form({ genres: `${genres}\n类型${MAX_NAMES + 1}` }))).toThrow(
      `类型最多 ${MAX_NAMES} 个，当前 ${MAX_NAMES + 1} 个。`,
    );
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
  it("新建和更新季／单集／曲目时丢掉封面，其他类型保留", () => {
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
    expect(parseMediaForm(form(episode)).cover_url).toBeNull();
    expect(parseMediaForm(form({ ...episode, id })).cover_url).toBeNull();
    expect(parseMediaForm(form({ ...episode, cover_url: "not a url" })).cover_url).toBeNull();
    expect(parseMediaForm(form({ ...episode, cover_url: "x".repeat(2001) })).cover_url).toBeNull();
    const track = { type: "music", title: "单曲", parent_id: parent, number: "1", cover_url: cover };
    expect(parseMediaForm(form(track)).cover_url).toBeNull();
    expect(parseMediaForm(form({ ...track, id })).cover_url).toBeNull();
    expect(coverUrlForSave("movie", cover)).toBe(cover);
    expect(coverUrlForSave("tv_show", cover)).toBe(cover);
    expect(coverUrlForSave("tv_episode", cover)).toBeNull();
    expect(coverUrlForSave("music", cover)).toBeNull();
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
        languages: "国语",
        regions: "台湾",
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
      languages: [],
      regions: ["台湾"],
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
        languages: "英语",
        composers: "\t作曲人",
        arrangers: "\t编曲人",
        producers: "\t制作人",
        featured: "\t合唱人",
        genres: "流行",
      }),
    );
    expect(track).toMatchObject({
      type: "music",
      parent_id: albumId,
      previous_parent_id: null,
      number: 3,
      disc_number: null,
      runtime: 215,
      status: "watched",
      rating: 8.5,
      cover_url: null,
      genres: ["流行"],
      languages: ["英语"],
      artists: [{ id: null, name: "主唱" }],
      lyricists: [{ id: null, name: "作词人" }],
      composers: [{ id: null, name: "作曲人" }],
      arrangers: [{ id: null, name: "编曲人" }],
      producers: [{ id: null, name: "制作人" }],
      featured: [{ id: null, name: "合唱人" }],
    });
    expect(
      parseMediaForm(
        form({
          type: "music",
          title: "第二盘",
          parent_id: albumId,
          previous_parent_id: albumId,
          number: "1",
          disc_number: "2",
          artists: "\t主唱",
        }),
      ),
    ).toMatchObject({
      disc_number: 2,
      previous_parent_id: albumId,
    });
    expect(
      parseMediaForm(
        form({
          type: "music",
          title: "保留盘号",
          parent_id: albumId,
          previous_parent_id: albumId,
          number: "1",
          artists: "\t主唱",
        }),
      ).disc_number,
    ).toBeNull();
    expect(
      parseMediaForm(
        form({
          type: "music",
          title: "双类型",
          parent_id: albumId,
          number: "1",
          artists: "\t主唱",
          genres: "流行\n说唱",
        }),
      ).genres,
    ).toEqual(["流行", "说唱"]);
    expect(() =>
      parseMediaForm(
        form({
          type: "music",
          title: "三类型",
          parent_id: albumId,
          number: "1",
          artists: "\t主唱",
          genres: "流行\n说唱\n摇滚",
        }),
      ),
    ).toThrow(/类型最多 2 个/);
    expect(() => parseMediaForm(form({ type: "music", title: "无上级", number: "1" }))).toThrow(/所属专辑/);
    expect(() =>
      parseMediaForm(
        form({
          type: "music",
          title: "小数秒",
          parent_id: albumId,
          number: "1",
          runtime: "3.5",
        }),
      ),
    ).toThrow(/时长、评分或编号超出有效范围/);
    expect(
      parseMediaForm(
        form({
          type: "music",
          title: "边界秒",
          parent_id: albumId,
          number: "1",
          runtime: "1",
        }),
      ).runtime,
    ).toBe(1);
    expect(
      parseMediaForm(
        form({
          type: "music",
          title: "上限秒",
          parent_id: albumId,
          number: "2",
          runtime: "7200",
        }),
      ).runtime,
    ).toBe(7200);
    expect(() =>
      parseMediaForm(
        form({
          type: "music",
          title: "零秒",
          parent_id: albumId,
          number: "1",
          runtime: "0",
        }),
      ),
    ).toThrow(/1–7200/);
    expect(() =>
      parseMediaForm(
        form({
          type: "music",
          title: "过长",
          parent_id: albumId,
          number: "1",
          runtime: "7201",
        }),
      ),
    ).toThrow(/时长、评分或编号超出有效范围/);
    expect(
      parseMediaForm(
        form({
          type: "movie",
          title: "长片",
          runtime: "180",
        }),
      ).runtime,
    ).toBe(180);
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

    // 曲目可设语言、仍清空地区；专辑清空语言、保留地区；图书保留提交值。
    const trackForm = form({
      type: "music",
      title: "曲目",
      parent_id: parentId,
      number: "1",
      languages: "英语",
      regions: "美国",
    });
    const trackResult = parseMediaForm(trackForm);
    expect(trackResult.languages).toEqual(["英语"]);
    expect(trackResult.regions).toEqual([]);

    const albumTaxonomy = parseMediaForm(
      form({
        type: "album",
        title: "专辑",
        languages: "国语\n粤语",
        regions: "香港",
      }),
    );
    expect(albumTaxonomy.languages).toEqual([]);
    expect(albumTaxonomy.regions).toEqual(["香港"]);

    const bookTaxonomy = parseMediaForm(
      form({
        type: "book",
        title: "图书",
        languages: "汉语",
        regions: "中国",
      }),
    );
    expect(bookTaxonomy.languages).toEqual(["汉语"]);
    expect(bookTaxonomy.regions).toEqual(["中国"]);
  });
});
