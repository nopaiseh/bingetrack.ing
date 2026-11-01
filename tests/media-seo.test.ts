import { describe, expect, it } from "vitest";
import type { EpisodeInfo, Media, SeasonInfo } from "@/lib/types";
import { buildMediaJsonLd, buildMediaMetadata, buildSeasonJsonLd, buildSeasonMetadata, getMediaDescription, serializeJsonLd } from "@/lib/seo/media";
import { SITE_URL } from "@/lib/site";

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

  it("builds TVSeason structured data linked to the parent series", /* 验证季号、集数、单集名称日期，以及与电视节目详情相同的绝对地址。 */ () => {
    const series = { ...movie, id: "series/1", type: "shows" as const, title: "测试剧集" };
    const season: SeasonInfo = {
      id: "season/1",
      seasonNumber: 2,
      title: "第二季",
      alternateTitle: "Season Two",
      coverUrl: "",
      episodeCount: 2,
      watchedEpisodeCount: 1,
      summary: "季度简介",
    };
    const episodes: EpisodeInfo[] = [
      {
        id: "ep-1",
        episodeNumber: 1,
        title: "启程",
        alternateTitle: "Departure",
        summary: "",
        coverUrl: "",
        releaseDate: "2026-01-02",
        runtime: 48,
        status: "watched",
        rating: 8,
      },
      {
        id: "ep-2",
        episodeNumber: 2,
        title: "  ",
        summary: "",
        coverUrl: "",
        releaseDate: null,
        runtime: null,
        status: null,
        rating: null,
      },
    ];

    const jsonLd = buildSeasonJsonLd(series, season, episodes);
    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "TVSeason",
      name: "第二季",
      alternateName: "Season Two",
      url: `${SITE_URL}/shows/series%2F1/seasons/season%2F1`,
      description: "季度简介",
      seasonNumber: 2,
      numberOfEpisodes: 2,
      image: series.cover_url,
      partOfSeries: {
        "@type": "TVSeries",
        name: series.title,
        url: buildMediaJsonLd(series).url,
      },
    });
    expect(jsonLd.episode).toEqual([
      {
        "@type": "TVEpisode",
        episodeNumber: 1,
        name: "启程",
        alternateName: "Departure",
        datePublished: "2026-01-02",
      },
      { "@type": "TVEpisode", episodeNumber: 2 },
    ]);
    expect(jsonLd.partOfSeries).not.toHaveProperty("@context");
  });

  it("omits season episodes and optional fields when the data is missing", /* 验证没有单集、海报和简介时不写入空字段，并使用与分享信息相同的默认描述。 */ () => {
    const series = { ...movie, id: "series-1", type: "shows" as const, cover_url: "" };
    const jsonLd = buildSeasonJsonLd(series, {
      id: "season-1",
      seasonNumber: 1,
      title: "第一季",
      coverUrl: "",
      episodeCount: 0,
      watchedEpisodeCount: 0,
    });

    expect(jsonLd.description).toBe("查看《测试电影》第一季的单集与观看记录。");
    expect(jsonLd.numberOfEpisodes).toBe(0);
    expect(jsonLd.episode).toBeUndefined();
    expect(jsonLd.image).toBeUndefined();
    expect(jsonLd.alternateName).toBeUndefined();
  });
});
