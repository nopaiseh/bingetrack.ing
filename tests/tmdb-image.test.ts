import { describe, expect, it } from "vitest";
import { tmdbImageSizeForWidth, tmdbImageUrl } from "../lib/tmdb-image";
import tmdbImageLoader from "../lib/tmdb-image-loader";

describe("tmdbImageUrl", /* 验证尺寸段替换只作用于 TMDB 图片地址。 */ () => {
  it("替换 original 和已有的尺寸段", () => {
    expect(tmdbImageUrl("https://image.tmdb.org/t/p/original/a.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/a.jpg");
    expect(tmdbImageUrl("https://image.tmdb.org/t/p/w500/a.jpg", "w92")).toBe("https://image.tmdb.org/t/p/w92/a.jpg");
  });

  it("空值返回空字符串，其他地址原样返回", () => {
    expect(tmdbImageUrl(null, "w500")).toBe("");
    expect(tmdbImageUrl("", "w500")).toBe("");
    expect(tmdbImageUrl("/opengraph-image", "w500")).toBe("/opengraph-image");
    expect(tmdbImageUrl("https://image.tmdb.org.evil.test/t/p/original/a.jpg", "w500")).toBe("https://image.tmdb.org.evil.test/t/p/original/a.jpg");
  });
});

describe("tmdbImageSizeForWidth", /* 验证宽度向上取到最近的档位，并在最大档位封顶。 */ () => {
  it.each([[1, "w92"], [92, "w92"], [93, "w154"], [192, "w342"], [384, "w500"], [500, "w500"], [501, "w780"], [1920, "w780"]])("宽度 %i 使用 %s", (width, size) => {
    expect(tmdbImageSizeForWidth(width)).toBe(size);
  });
});

describe("tmdbImageLoader", /* 验证 next/image 的 loader 直接返回 TMDB CDN 地址。 */ () => {
  it("按请求宽度返回 TMDB 地址，不指向 /_next/image", () => {
    expect(tmdbImageLoader({ src: "https://image.tmdb.org/t/p/original/a.jpg", width: 342 })).toBe("https://image.tmdb.org/t/p/w342/a.jpg");
  });

  it("本地图片原样返回", () => {
    expect(tmdbImageLoader({ src: "/opengraph-image", width: 500 })).toBe("/opengraph-image");
  });
});
