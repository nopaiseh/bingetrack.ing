import { describe, expect, it } from "vitest";
import type { Media } from "@/lib/types";
import { buildMediaJsonLd, buildMediaMetadata, buildSeasonMetadata, getMediaDescription, serializeJsonLd, truncateMetaDescription } from "@/lib/seo/media";

const movie: Media = {
  id: "movie/id",
  title: "测试电影",
  alternate_title: "Test Movie",
  date: "2026-08-30",
  runtime: 123,
  rating: 8,
  genres: ["剧情"],
  languages: ["华语"],
  regions: ["新加坡"],
  summary: "一部用于测试动态 SEO 的电影。",
  cover_url: "https://images.example.com/poster.jpg",
  casts: ["演员甲"],
  directors: ["导演甲"],
  type: "movies",
};

describe("media SEO", /* 组织媒体与季页面的元数据、结构化数据和序列化测试。 */ () => {
  it("builds canonical and social metadata for a movie", /* 验证电影规范地址、Open Graph 和 Twitter 分享字段。 */ () => {
    const metadata = buildMediaMetadata(movie);

    expect(metadata.alternates?.canonical).toBe("/movies/movie%2Fid");
    expect(metadata.openGraph).toMatchObject({
      title: movie.title,
      description: movie.summary,
      url: "/movies/movie%2Fid",
      images: [{ url: movie.cover_url, alt: `${movie.title} 海报` }],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [movie.cover_url],
    });
  });

  it("builds Movie structured data", /* 验证电影 JSON-LD 中的类型、名称、时长和演职员字段。 */ () => {
    expect(buildMediaJsonLd(movie)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Movie",
      name: movie.title,
      alternateName: movie.alternate_title,
      duration: "PT123M",
      director: [{ "@type": "Person", name: "导演甲" }],
      actor: [{ "@type": "Person", name: "演员甲" }],
    });
  });

  it("builds TVSeries structured data and a useful fallback description", /* 验证电视节目使用 TVSeries 类型，并在无简介时生成季度与单集描述。 */ () => {
    const series = { ...movie, id: "series-1", type: "shows" as const, summary: "" };

    expect(getMediaDescription(series)).toBe("查看《测试电影》的季度、单集与观看记录。");
    expect(getMediaDescription({ ...series, summary: " \n\t " })).toBe("查看《测试电影》的季度、单集与观看记录。");
    expect(buildMediaJsonLd(series)["@type"]).toBe("TVSeries");
    expect(buildMediaMetadata(series).alternates?.canonical).toBe("/shows/series-1");
  });

  it("escapes markup-like text in JSON-LD", /* 验证 JSON-LD 转义脚本闭合文本，避免输出原始结束标签。 */ () => {
    expect(serializeJsonLd({ value: "</script>" })).not.toContain("</script>");
  });

  it("builds canonical and social metadata for a season", /* 验证季页面生成正确的规范地址、标题与分享海报。 */ () => {
    const metadata = buildSeasonMetadata(
      { ...movie, id: "series-1", type: "shows" },
      {
        id: "season-1",
        seasonNumber: 1,
        title: "第一季",
        coverUrl: "https://images.example.com/season.jpg",
        episodeCount: 10,
        watchedEpisodeCount: 8,
        summary: "季度简介",
      },
    );

    expect(metadata.alternates?.canonical).toBe("/shows/series-1/seasons/season-1");
    expect(metadata.openGraph).toMatchObject({
      title: "测试电影 · 第一季",
      description: "季度简介",
      images: [{ url: "https://images.example.com/season.jpg" }],
    });
  });

  it("cuts a long Chinese synopsis at the last nearby clause", /* 中文简介停在约 80 字内的最后一个句读，不再从半句话切断。 */ () => {
    const summary = "《跑男》讲述了一群固定成员与每期嘉宾在城市地标、商场、学校、游乐园等不同场地中展开追逐与竞技的故事。节目自2010年7月在SBS首播，每期由制作组设定一个主题和一套规则，成员们或两两组队、或各自为战，通过闯关游戏、解谜寻找线索、完成任务来争取奖励或逃避惩罚。节目最具代表性的环节是“撕名牌”：每个人背后贴着写有自己名字的名牌，一旦被对手撕下即被淘汰。";
    const expected = "《跑男》讲述了一群固定成员与每期嘉宾在城市地标、商场、学校、游乐园等不同场地中展开追逐与竞技的故事。节目自2010年7月在SBS首播，…";

    expect(truncateMetaDescription(summary)).toBe(expected);
    expect(expected.endsWith("…")).toBe(true);
    expect(expected).not.toContain("名字的");

    const metadata = buildMediaMetadata({ ...movie, id: "running-man", type: "shows", title: "跑男", summary });
    expect(metadata.description).toBe(expected);
    expect(metadata.openGraph).toMatchObject({ description: expected });
    expect(metadata.twitter).toMatchObject({ description: expected });
    expect(buildMediaJsonLd({ ...movie, id: "running-man", type: "shows", title: "跑男", summary }).description).toBe(expected);
  });

  it("cuts a Chinese movie synopsis on a clause and collapses paragraph breaks", /* 电影简介在逗号处收束，并去掉会进入 meta 标签的换行。 */ () => {
    const summary = "去年的全国阿卡贝拉总决赛上，巴顿大学女子合唱团“巴顿贝拉”的领唱奥布里紧张过度，当众吐在了舞台上，团队颜面尽失。新学年，奥布里成了团长，决心带领贝拉们一雪前耻，可老团员几乎走光，她只能一边死守老套的曲目，一边四处招人。\r\n\r\n贝卡是个酷爱混音、梦想去洛杉矶做音乐制作的新生。在巴顿大学任教的父亲答应她：认真读完一年、参加一个社团，如果还想退学，就支持她去追梦。";
    const expected = "去年的全国阿卡贝拉总决赛上，巴顿大学女子合唱团“巴顿贝拉”的领唱奥布里紧张过度，当众吐在了舞台上，团队颜面尽失。新学年，奥布里成了团长，决心带领贝拉们一雪前耻，…";

    expect(getMediaDescription({ ...movie, title: "完美音调", summary })).toBe(expected);
    expect(expected).not.toMatch(/[\r\n]/);
    expect(expected).not.toContain("参加");
  });

  it("leaves Chinese and English synopses unchanged when they already fit", /* 未超出上限的简介保持原文，也不追加省略号。 */ () => {
    expect(truncateMetaDescription("一部用于测试动态 SEO 的电影。")).toBe("一部用于测试动态 SEO 的电影。");
    expect(truncateMetaDescription("字".repeat(80))).toBe("字".repeat(80));
    expect(truncateMetaDescription("A short English synopsis.")).toBe("A short English synopsis.");
    expect(truncateMetaDescription("A".repeat(160))).toBe("A".repeat(160));
    expect(truncateMetaDescription("  首尾空白应去掉。  ")).toBe("首尾空白应去掉。");
  });

  it("cuts a long English synopsis near 160 characters on a word boundary", /* 英文没有靠近上限的句读时，停在单词之间，长度仍接近 160。 */ () => {
    const summary = "A group of friends try to survive a night in a haunted house after a dare goes wrong. They discover the legend is real, and the only way out is to finish the story before sunrise or remain inside forever.";
    const expected = "A group of friends try to survive a night in a haunted house after a dare goes wrong. They discover the legend is real, and the only way out is to finish the…";

    expect(truncateMetaDescription(summary)).toBe(expected);
    expect(expected.endsWith("…")).toBe(true);
    expect(expected.length).toBeGreaterThanOrEqual(150);
    expect(expected.length).toBeLessThanOrEqual(161);
    expect(expected).not.toContain("story");
  });

  it("does not treat a decimal point as a sentence break", /* 版本号里的小数点要留在句子中，截断改到后面的句号。 */ () => {
    const summary = "Released as version 2.5 in 2012, the choir kept singing through rehearsals, arguments, and one last rewrite before opening night at the old municipal hall. The audience stayed until the lights came back up and the credits finished rolling over the empty seats.";
    const description = truncateMetaDescription(summary);

    expect(description).toContain("version 2.5");
    expect(description.endsWith("hall.…")).toBe(true);
    expect(description).not.toContain("audience");
  });

  it("hard-cuts a Chinese synopsis that has no nearby punctuation", /* 后半段没有句读时按约 80 个汉字截断，并补上省略号。 */ () => {
    const summary = "这是一段完全没有句读的中文简介".repeat(6);
    const description = truncateMetaDescription(summary);

    expect(description.endsWith("…")).toBe(true);
    expect([...description.slice(0, -1)].length).toBe(80);
    expect(summary.startsWith(description.slice(0, -1))).toBe(true);
  });

  it("uses one truncated season description for meta, Open Graph, and Twitter", /* 季页面的三段描述与截断后的简介相同。 */ () => {
    const summary = "《跑男》讲述了一群固定成员与每期嘉宾在城市地标、商场、学校、游乐园等不同场地中展开追逐与竞技的故事。节目自2010年7月在SBS首播，每期由制作组设定一个主题和一套规则，成员们或两两组队、或各自为战，通过闯关游戏、解谜寻找线索、完成任务来争取奖励或逃避惩罚。";
    const expected = truncateMetaDescription(summary);
    const metadata = buildSeasonMetadata(
      { ...movie, id: "series-1", type: "shows", title: "跑男" },
      {
        id: "season-1",
        seasonNumber: 1,
        title: "第一季",
        coverUrl: "https://images.example.com/season.jpg",
        episodeCount: 10,
        watchedEpisodeCount: 8,
        summary,
      },
    );

    expect(metadata.description).toBe(expected);
    expect(metadata.openGraph).toMatchObject({ description: expected });
    expect(metadata.twitter).toMatchObject({ description: expected });
    expect(String(metadata.description).endsWith("…")).toBe(true);
  });
});
