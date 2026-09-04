import { describe, expect, it } from "vitest";
import type { Media } from "@/lib/types";
import { buildMediaJsonLd, buildMediaMetadata, buildSeasonMetadata, getMediaDescription, serializeJsonLd } from "@/lib/seo/media";

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

describe("media SEO", () => {
  it("builds canonical and social metadata for a movie", () => {
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

  it("builds Movie structured data", () => {
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

  it("builds TVSeries structured data and a useful fallback description", () => {
    const series = { ...movie, id: "series-1", type: "series" as const, summary: "" };

    expect(getMediaDescription(series)).toBe("查看《测试电影》的季度、剧集与观看记录。");
    expect(buildMediaJsonLd(series)["@type"]).toBe("TVSeries");
    expect(buildMediaMetadata(series).alternates?.canonical).toBe("/series/series-1");
  });

  it("escapes markup-like text in JSON-LD", () => {
    expect(serializeJsonLd({ value: "</script>" })).not.toContain("</script>");
  });

  it("builds canonical and social metadata for a season", () => {
    const metadata = buildSeasonMetadata(
      { ...movie, id: "series-1", type: "series" },
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

    expect(metadata.alternates?.canonical).toBe("/series/series-1/seasons/season-1");
    expect(metadata.openGraph).toMatchObject({
      title: "测试电影 · 第一季",
      description: "季度简介",
      images: [{ url: "https://images.example.com/season.jpg" }],
    });
  });
});
