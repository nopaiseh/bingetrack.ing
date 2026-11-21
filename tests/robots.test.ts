import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { SITE_URL } from "@/lib/site";

describe("robots", () => {
  it("禁止抓取带查询参数的 /search，其余规则与站点地图不变", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/manage", "/settings", "/auth/", "/search?"],
      },
      sitemap: `${SITE_URL}/sitemap.xml`,
    });
  });
});
