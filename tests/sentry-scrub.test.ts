import { describe, expect, it } from "vitest";
import type { Event } from "@sentry/nextjs";
import { scrubSentryBreadcrumb, scrubSentryEvent, scrubSensitiveUrl } from "@/lib/sentry-scrub";

const SECRET = "one-time-secret";

describe("scrubSensitiveUrl", () => {
  it("去掉 URL 里的 token_hash、token 和 code，保留其他参数和 hash", () => {
    expect(scrubSensitiveUrl(
      `https://www.bingetrack.ing/auth/confirm?token_hash=${SECRET}&type=magiclink&next=%2Fmanage&code=${SECRET}&token=${SECRET}#done`,
    )).toBe("https://www.bingetrack.ing/auth/confirm?type=magiclink&next=%2Fmanage#done");
  });

  it("相对路径只剩敏感参数时不再留下问号", () => {
    expect(scrubSensitiveUrl(`/auth/confirm?token_hash=${SECRET}`)).toBe("/auth/confirm");
    expect(scrubSensitiveUrl(`GET /auth/confirm?type=magiclink&token_hash=${SECRET}`)).toBe("GET /auth/confirm?type=magiclink");
  });

  it("单独的查询串按参数删除，不把普通句子改掉", () => {
    expect(scrubSensitiveUrl(`token_hash=${SECRET}&next=%2Fsettings`)).toBe("next=%2Fsettings");
    expect(scrubSensitiveUrl(`登录失败 token_hash=${SECRET}`)).toBe(`登录失败 token_hash=${SECRET}`);
    expect(scrubSensitiveUrl("/auth/confirm/token_hash/not-a-query")).toBe("/auth/confirm/token_hash/not-a-query");
  });

  it("参数名大小写不敏感，且不误伤带前缀的键", () => {
    expect(scrubSensitiveUrl("?Token_Hash=abc&mytoken=keep&code=drop")).toBe("?mytoken=keep");
  });
});

describe("scrubSentryEvent", () => {
  it("清理请求、事务名、面包屑和 span 中的一次性凭证", () => {
    const event: Event = {
      request: {
        url: `https://www.bingetrack.ing/auth/confirm?token_hash=${SECRET}&type=magiclink`,
        query_string: `token_hash=${SECRET}&type=magiclink`,
        headers: { Referer: `https://www.bingetrack.ing/auth/confirm?token_hash=${SECRET}` },
      },
      transaction: `GET /auth/confirm?token_hash=${SECRET}&type=magiclink`,
      breadcrumbs: [
        { category: "navigation", data: { from: "/movies", to: `/auth/confirm?token_hash=${SECRET}&type=invite` } },
        { category: "fetch", data: { url: `https://www.bingetrack.ing/auth/confirm?code=${SECRET}`, "url.query": `code=${SECRET}&next=%2Fmanage` } },
      ],
      spans: [
        {
          span_id: "span",
          trace_id: "trace",
          start_timestamp: 0,
          status: "ok",
          description: `GET https://www.bingetrack.ing/auth/confirm?token=${SECRET}`,
          data: {
            url: `/auth/confirm?token_hash=${SECRET}`,
            "url.full": `https://www.bingetrack.ing/auth/confirm?token_hash=${SECRET}&next=%2Fmanage`,
            "url.query": `token_hash=${SECRET}&next=%2Fmanage`,
            "http.status_code": 200,
            "url.list": [`/auth/confirm?token_hash=${SECRET}`, "/settings"],
          },
        },
      ],
    };

    expect(scrubSentryEvent(event)).toBe(event);
    expect(event.request?.url).toBe("https://www.bingetrack.ing/auth/confirm?type=magiclink");
    expect(event.request?.query_string).toBe("type=magiclink");
    expect(event.request?.headers?.Referer).toBe("https://www.bingetrack.ing/auth/confirm");
    expect(event.transaction).toBe("GET /auth/confirm?type=magiclink");
    expect(event.breadcrumbs?.[0]?.data?.to).toBe("/auth/confirm?type=invite");
    expect(event.breadcrumbs?.[1]?.data?.url).toBe("https://www.bingetrack.ing/auth/confirm");
    expect(event.breadcrumbs?.[1]?.data?.["url.query"]).toBe("next=%2Fmanage");
    expect(event.spans?.[0]?.description).toBe("GET https://www.bingetrack.ing/auth/confirm");
    expect(event.spans?.[0]?.data?.url).toBe("/auth/confirm");
    expect(event.spans?.[0]?.data?.["url.full"]).toBe("https://www.bingetrack.ing/auth/confirm?next=%2Fmanage");
    expect(event.spans?.[0]?.data?.["url.query"]).toBe("next=%2Fmanage");
    expect(event.spans?.[0]?.data?.["http.status_code"]).toBe(200);
    expect(event.spans?.[0]?.data?.["url.list"]).toEqual(["/auth/confirm", "/settings"]);
    expect(JSON.stringify(event)).not.toContain(SECRET);
  });

  it("对象和元组形式的 query_string 也删除敏感键", () => {
    const event: Event = {
      request: { query_string: { token_hash: SECRET, type: "magiclink", code: SECRET } },
    };
    scrubSentryEvent(event);
    expect(event.request?.query_string).toEqual({ type: "magiclink" });

    const tuples: Event = {
      request: { query_string: [["token", SECRET], ["next", "/manage"]] },
    };
    scrubSentryEvent(tuples);
    expect(tuples.request?.query_string).toEqual([["next", "/manage"]]);
  });

  it("清理事务根 span contexts.trace.data 里的 url.full 和 http.query", () => {
    const event: Event = {
      type: "transaction",
      contexts: {
        trace: {
          span_id: "root",
          trace_id: "trace",
          data: {
            "url.full": `https://www.bingetrack.ing/auth/confirm?token_hash=${SECRET}&type=magiclink`,
            "http.query": `token_hash=${SECRET}&type=magiclink`,
          },
        },
      },
    };
    scrubSentryEvent(event);
    expect(event.contexts?.trace?.data?.["url.full"]).toBe("https://www.bingetrack.ing/auth/confirm?type=magiclink");
    expect(event.contexts?.trace?.data?.["http.query"]).toBe("type=magiclink");
    expect(JSON.stringify(event)).not.toContain(SECRET);
  });

  it("面包屑可以单独清理", () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: "navigation",
      message: `https://www.bingetrack.ing/auth/confirm?token_hash=${SECRET}`,
      data: { from: `/auth/confirm?code=${SECRET}`, to: "/settings" },
    });
    expect(breadcrumb.message).toBe("https://www.bingetrack.ing/auth/confirm");
    expect(breadcrumb.data?.from).toBe("/auth/confirm");
    expect(breadcrumb.data?.to).toBe("/settings");
  });
});
