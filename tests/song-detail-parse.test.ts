import { describe, expect, it } from "vitest";
import { parseSongDetail } from "@/lib/functions/song-repo";

const songId = "50000000-0000-4000-8000-000000000021";
const personId = "40000000-0000-4000-8000-000000000004";
const albumId = "50000000-0000-4000-8000-000000000020";
const relatedId = "50000000-0000-4000-8000-000000000024";

describe("parseSongDetail", () => {
  it("解析 get_song_detail 最终形状并保留封面回退值", () => {
    const detail = parseSongDetail({
      id: songId,
      title: "夜航序曲",
      alternate_title: "Night Overture",
      duration_seconds: 210,
      release_date: "2024-05-20",
      summary: "忽略展示",
      cover_url: "https://example.com/album-fallback.jpg",
      genres: ["流行"],
      languages: ["国语"],
      series: [],
      credits: {
        artist: [{ id: personId, name: "测试艺人", alternate_name: "Fixture Artist" }],
        lyricist: [{ id: "40000000-0000-4000-8000-000000000005", name: "测试词人", alternate_name: null }],
      },
      albums: [
        {
          id: albumId,
          title: "测试专辑：夜航电台",
          cover_url: "https://example.com/album.jpg",
          release_date: "2024-05-20",
          release_kind: "album",
          disc_number: 1,
          track_number: 1,
          other_tracks: [
            {
              id: "50000000-0000-4000-8000-000000000022",
              title: "回港信号",
              disc_number: 1,
              track_number: 2,
              duration_seconds: 185,
            },
          ],
        },
      ],
      related: [
        {
          id: relatedId,
          title: "独立航标",
          cover_url: null,
          release_date: "2024-07-01",
          relations: ["artist", "composer"],
        },
      ],
      tracking: { status: "watched", rating: 8.5 },
    });

    expect(detail).toMatchObject({
      id: songId,
      title: "夜航序曲",
      cover_url: "https://example.com/album-fallback.jpg",
      tracking: { status: "watched", rating: 8.5 },
    });
    expect(detail?.credits.artist?.[0]?.id).toBe(personId);
    expect(detail?.albums[0]?.other_tracks).toHaveLength(1);
    expect(detail?.related[0]?.relations).toEqual(["artist", "composer"]);
  });

  it("非法或空载荷回退为 null", () => {
    expect(parseSongDetail(null)).toBeNull();
    expect(parseSongDetail({ title: "无 id" })).toBeNull();
    expect(parseSongDetail({ id: "not-a-uuid", title: "坏 id" })).toBeNull();
  });

  it("缺封面时 cover_url 为 null（由页头 LetterTile 占位）", () => {
    const detail = parseSongDetail({
      id: songId,
      title: "无封面",
      alternate_title: null,
      duration_seconds: null,
      release_date: null,
      summary: null,
      cover_url: null,
      genres: [],
      languages: [],
      series: [],
      credits: {},
      albums: [],
      related: [],
      tracking: null,
    });
    expect(detail?.cover_url).toBeNull();
  });
});
