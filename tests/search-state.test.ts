import { expect, test } from "vitest";
import {
  buildMediaSearchQuery,
  hasOnlyKnownFilterValues,
  migrateLegacyCreditRolesFromType,
  readFilters,
  writeFilters,
} from "@/lib/api/search-state";
import { parseMediaSearchParams } from "@/lib/api/media-params";
import { EMPTY_FILTERS } from "@/components/search/search-model";

test(
  "server and browser query conversion preserves all search categories",
  /* 验证服务端与浏览器共用的转换函数保留分类、人物角色、状态、属性、年份及分页条件。 */ () => {
    const query = buildMediaSearchQuery(
      new URLSearchParams({
        q: " 王家卫 ",
        type: "movie,tv_show,series",
        creditRole: "director,actor,author",
        status: "watched,want_to_watch,watching",
        genre: "剧情,喜剧",
        region: "香港",
        language: "粤语",
        startYear: "1990",
        endYear: "2025",
        sort: "rating_desc",
        page: "2",
      }),
    );
    expect(parseMediaSearchParams(new URLSearchParams(query))).toEqual({
      q: "王家卫",
      type: "movie,tv_show",
      creditRole: "director,actor,author",
      seriesOnly: true,
      status: "watched,want_to_watch,watching",
      genre: "剧情,喜剧",
      region: "香港",
      language: "粤语",
      startYear: "1990",
      endYear: "2025",
      sort: "rating_desc",
      limit: 30,
      offset: 30,
      upcoming: false,
    });
  },
);

test(
  "readFilters and writeFilters round-trip creditRole independently of type",
  /* 验证人物角色写入 URL creditRole，并与分类参数可组合。 */ () => {
    const filters = {
      ...EMPTY_FILTERS,
      type: ["book", "music"],
      creditRole: ["author", "artist"],
      status: ["watched"],
    };
    const params = new URLSearchParams({ q: "周杰伦" });
    writeFilters(params, filters);
    expect(params.get("type")).toBe("book,music");
    expect(params.get("creditRole")).toBe("author,artist");
    expect(params.get("status")).toBe("watched");
    expect(params.get("q")).toBe("周杰伦");
    expect(readFilters(params)).toEqual(
      expect.objectContaining({
        type: ["book", "music"],
        creditRole: ["author", "artist"],
        status: ["watched"],
      }),
    );
    expect(readFilters(new URLSearchParams()).creditRole).toEqual([]);
  },
);

test(
  "empty creditRole means no person role limit in the API query",
  /* 「全部」人物不写 creditRole，只选人物时也不带 type。 */ () => {
    const withPerson = new URLSearchParams(
      buildMediaSearchQuery(new URLSearchParams({ q: "诺兰", creditRole: "director" })),
    );
    expect(withPerson.get("creditRole")).toBe("director");
    expect(withPerson.get("type")).toBeNull();

    const allPeople = new URLSearchParams(buildMediaSearchQuery(new URLSearchParams({ q: "诺兰" })));
    expect(allPeople.get("creditRole")).toBeNull();
  },
);

test.each(["director", "actor"] as const)(
  "migrateLegacyCreditRolesFromType moves type=%s into creditRole and keeps other params",
  /* 旧分类人物角色迁到 creditRole；可与媒体 type／已有 creditRole 合并。 */ (role) => {
    const params = new URLSearchParams({
      q: "测试",
      type: `movie,${role}`,
      creditRole: "author",
      status: "watched",
    });
    expect(migrateLegacyCreditRolesFromType(params)).toBe(true);
    expect(params.get("type")).toBe("movie");
    expect(params.get("creditRole")?.split(",").sort()).toEqual(["author", role].sort());
    expect(params.get("q")).toBe("测试");
    expect(params.get("status")).toBe("watched");
    expect(migrateLegacyCreditRolesFromType(params)).toBe(false);
  },
);

test(
  "the upcoming status option becomes a separate API flag",
  /* 验证“即将上映”状态选项转换为独立的 upcoming 参数，不混入观看状态。 */ () => {
    expect(hasOnlyKnownFilterValues(new URLSearchParams({ status: "upcoming,want_to_watch" }))).toBe(true);
    const params = parseMediaSearchParams(
      new URLSearchParams(buildMediaSearchQuery(new URLSearchParams({ status: "upcoming,want_to_watch" }))),
    );
    expect(params.status).toBe("want_to_watch");
    expect(params.upcoming).toBe(true);
  },
);

test.each(["-1", "NaN", "Infinity", "1.5"])(
  "invalid page %s uses the first page",
  /* 对每个非法页码验证 API 偏移量回退为零。 */ (page) => {
    expect(new URLSearchParams(buildMediaSearchQuery(new URLSearchParams({ page }))).get("offset")).toBe("0");
  },
);

test.each<Record<string, string>>([
  { type: "电影" },
  { type: "tv_series" },
  { type: "director" },
  { creditRole: "producer" },
  { status: "已看" },
  { sort: "评分" },
])(
  "unknown filter values %o are rejected",
  /* 验证分类、人物、状态和排序中的旧版中文值与未知值都判定为无效地址。 */ (params) => {
    expect(hasOnlyKnownFilterValues(new URLSearchParams(params))).toBe(false);
  },
);

test(
  "canonical filter values and free-text attributes are accepted",
  /* 验证规范值通过校验，类型、地区等属性的中文取值不受影响。 */ () => {
    expect(
      hasOnlyKnownFilterValues(
        new URLSearchParams({
          q: "王家卫",
          type: "movie,tv_show,series",
          creditRole: "director,lyricist,composer,author",
          status: "watched",
          sort: "rating_desc",
          genre: "剧情",
          region: "香港",
        }),
      ),
    ).toBe(true);
  },
);

test(
  "type=music is a known search filter and reaches the API query",
  /* 验证单曲可经 URL 筛选进入构建后的 API 参数。 */ () => {
    expect(hasOnlyKnownFilterValues(new URLSearchParams({ type: "music", status: "want_to_watch" }))).toBe(true);
    const query = buildMediaSearchQuery(
      new URLSearchParams({ type: "music", status: "watched", startYear: "2020", endYear: "2020" }),
    );
    expect(parseMediaSearchParams(new URLSearchParams(query))).toEqual(
      expect.objectContaining({
        type: "music",
        status: "watched",
        startYear: "2020",
        endYear: "2020",
      }),
    );
  },
);
