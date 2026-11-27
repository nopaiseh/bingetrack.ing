import { describe, expect, it } from "vitest";
import { parsePersonWorks } from "@/lib/functions/person-repo";

const personId = "40000000-0000-4000-8000-000000000004";
const songId = "50000000-0000-4000-8000-000000000021";
const albumId = "50000000-0000-4000-8000-000000000020";

describe("parsePersonWorks", () => {
  it("解析按角色分组的音乐作品并丢掉空分组项", () => {
    const works = parsePersonWorks({
      person_id: personId,
      film_tv: [],
      music: {
        albums: [
          {
            role: "artist",
            label: "艺人",
            items: [
              {
                id: albumId,
                type: "album",
                title: "测试专辑：夜航电台",
                alternate_title: null,
                cover_url: null,
                release_date: "2024-05-20",
                release_kind: "album",
              },
            ],
          },
        ],
        songs: [
          {
            role: "artist",
            label: "艺人",
            items: [
              {
                id: songId,
                type: "music",
                title: "夜航序曲",
                alternate_title: null,
                cover_url: "https://example.com/cover.jpg",
                release_date: "2024-05-20",
              },
            ],
          },
          { role: "lyricist", label: "作词", items: [] },
        ],
      },
      books: [],
    });

    expect(works?.music.albums).toHaveLength(1);
    expect(works?.music.songs).toHaveLength(1);
    expect(works?.music.songs[0]?.items[0]?.id).toBe(songId);
    expect(works?.film_tv).toEqual([]);
    expect(works?.books).toEqual([]);
  });

  it("非法载荷回退为 null", () => {
    expect(parsePersonWorks(null)).toBeNull();
    expect(parsePersonWorks({ person_id: "bad", film_tv: [], music: {}, books: [] })).toBeNull();
  });
});
