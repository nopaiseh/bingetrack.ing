import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

import { metadata as manageMetadata } from "@/app/(admin)/manage/layout";
import { metadata as settingsMetadata } from "@/app/(admin)/settings/layout";
import { metadata as rootMetadata } from "@/app/layout";
import { metadata as moviesMetadata } from "@/app/movies/page";
import { metadata as homeMetadata } from "@/app/page";
import { generateMetadata as searchMetadata } from "@/app/search/page";
import { metadata as showsMetadata } from "@/app/shows/page";

describe("listing canonicals", /* 检查四个公开目录页的规范地址，并确认根布局没有会向下继承的规范地址。 */ () => {
  it("points the four public indexes at their own paths", /* 验证首页、电影、电视节目和搜索使用相对路径，交给 metadataBase 解析成正式域名。 */ async () => {
    expect(homeMetadata.alternates?.canonical).toBe("/");
    expect(moviesMetadata.alternates?.canonical).toBe("/movies");
    expect(showsMetadata.alternates?.canonical).toBe("/shows");
    expect(await searchMetadata({ searchParams: Promise.resolve({}) })).toMatchObject({
      alternates: { canonical: "/search" },
      robots: { index: true, follow: true },
    });
    expect(await searchMetadata({ searchParams: Promise.resolve({ q: "测试" }) })).toEqual({
      robots: { index: false, follow: true },
    });
  });

  it("does not set a canonical on the root layout", /* 验证根布局、管理页和设置页都不声明规范地址，避免未单独设置的子页面指向首页。 */ () => {
    expect(rootMetadata.alternates).toBeUndefined();
    expect(manageMetadata.alternates).toBeUndefined();
    expect(settingsMetadata.alternates).toBeUndefined();
  });
});
