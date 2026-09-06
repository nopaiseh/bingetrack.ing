import { expect, test } from "@playwright/test";

const MOVIE_ID = "50000000-0000-4000-8000-000000000001";
const SERIES_ID = "50000000-0000-4000-8000-000000000002";
const SEASON_ID = "50000000-0000-4000-8000-000000000003";
const MISSING_ID = "50000000-0000-4000-8000-000000000099";

test("search finds a seeded movie and preserves the return path", /* 验证搜索能找到固定测试电影，进入详情后可以返回原搜索地址。 */ async ({ page }) => {
  await page.goto("/search?q=星光档案");

  await expect(page.getByRole("heading", { name: /星光档案.*搜索结果/ })).toBeVisible();
  await expect(page.getByText("找到 1 部作品")).toBeVisible();
  await page.getByRole("link", { name: /测试电影：星光档案/ }).click();

  await expect(page).toHaveURL(new RegExp(`/movies/${MOVIE_ID}`));
  await expect(page.getByRole("heading", { level: 1, name: "测试电影：星光档案" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回搜索页" })).toBeVisible();
});

test("type and year filters update the URL and results", /* 验证媒体分类和年份筛选同时更新地址与结果。 */ async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText("找到 2 部作品")).toBeVisible();

  await page.getByRole("button", { name: "电视剧" }).click();
  await expect(page).toHaveURL(/type=%E7%94%B5%E8%A7%86%E5%89%A7/);
  await expect(page.getByText("找到 1 部作品")).toBeVisible();
  await expect(page.getByRole("link", { name: /测试剧集：城市信号/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /测试电影：星光档案/ })).toHaveCount(0);

  await page.goto("/search?type=%E7%94%B5%E8%A7%86%E5%89%A7&startYear=2025&endYear=2025");
  await expect(page.getByText("找到 1 部作品")).toBeVisible();
  await expect(page.getByRole("link", { name: /测试剧集：城市信号/ })).toBeVisible();
});

test("search pagination requests the next offset and keeps filters", /* 用分页模拟响应验证翻页请求的偏移量及筛选参数保留行为。 */ async ({ page }) => {
  const row = {
    id: MOVIE_ID,
    title: "分页测试电影",
    date: "2024-01-01",
    rating: 7.5,
    genres: [],
    languages: [],
    regions: [],
    cover_url: "",
    type: "movies",
  };

  await page.route("**/api/media**", /* 根据请求偏移量返回不同标题和固定总数，便于检查分页请求。 */ async (route) => {
    const offset = new URL(route.request().url()).searchParams.get("offset");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rows: [{ ...row, title: `分页测试电影 ${offset}` }], total: 31 }),
    });
  });

  await page.goto("/search?type=%E7%94%B5%E5%BD%B1");
  await page.getByRole("textbox", { name: "搜索媒体", exact: true }).fill("分页测试");
  await expect(page.getByText("分页测试电影 0")).toBeVisible();
  await page.getByRole("navigation", { name: "搜索结果分页" })
    .getByRole("button", { name: "2", exact: true })
    .click();

  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/type=%E7%94%B5%E5%BD%B1/);
  await expect(page.getByText("分页测试电影 30")).toBeVisible();
});

test("series and season pages render episode progress and filtering", /* 验证电视剧到季页面的导航、剧集标题及未看筛选。 */ async ({ page }) => {
  await page.goto(`/series/${SERIES_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "测试剧集：城市信号" })).toBeVisible();
  await expect(page.getByRole("link", { name: /城市信号 第一季.*2 集/ })).toBeVisible();

  await page.getByRole("link", { name: /城市信号 第一季/ }).click();
  await expect(page).toHaveURL(new RegExp(`/series/${SERIES_ID}/seasons/${SEASON_ID}`));
  await expect(page.getByRole("heading", { level: 1, name: "城市信号 第一季" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "启程" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "回声" })).toBeVisible();

  await page.getByRole("link", { name: "未看", exact: true }).click();
  await expect(page).toHaveURL(/status=unwatched/);
  await expect(page.getByRole("heading", { level: 2, name: "回声" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "启程" })).toHaveCount(0);
});

test("search shows a recoverable error when the media API fails", /* 模拟媒体 API 失败，验证搜索页面显示可恢复的错误提示。 */ async ({ page }) => {
  await page.route("**/api/media**", /* 为媒体请求返回 503 和固定错误体。 */ (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "fixture failure" }),
  }));

  await page.goto("/search");
  await page.getByRole("textbox", { name: "搜索媒体", exact: true }).fill("故障测试");
  await expect(page.getByText("暂时无法加载搜索结果，请稍后重试。")).toBeVisible();
  await expect(page.getByText("加载失败")).toBeVisible();
});

test("missing media uses the application 404 page", /* 访问不存在的电影 ID，验证应用展示 404 页面。 */ async ({ page }) => {
  await page.goto(`/movies/${MISSING_ID}`);
  await expect(page.getByRole("heading", { name: "页面未找到" })).toBeVisible();
});

test("media API rejects invalid query parameters", /* 发送非法类型和年份参数，验证 API 返回 400 及年份错误信息。 */ async ({ request }) => {
  const response = await request.get("/api/media?type=invalid&startYear=2050");
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: "Invalid start year" });
});


test("search results render before application hydration without a client data request", /* 阻断应用脚本和客户端搜索请求，验证服务端 HTML 已包含搜索结果。 */ async ({ page }) => {
  const mediaRequests: string[] = [];
  // 只阻断应用脚本，保留 React 流式 HTML 的内联展示脚本，以验证水合前的搜索结果。
  await page.route(/\/_next\/.*\.js(?:\?|$)/, /* 取消应用脚本请求，阻止客户端水合。 */ (route) => route.abort());
  await page.route("**/api/media**", /* 记录并阻断客户端媒体请求，用于断言首屏没有发起该请求。 */ (route) => {
    mediaRequests.push(route.request().url());
    return route.abort();
  });

  await page.goto("/search?q=星光档案");
  await expect(page.getByRole("heading", { name: "测试电影：星光档案", exact: true })).toBeVisible();
  await expect(page.getByText("找到 1 部作品")).toBeVisible();
  expect(mediaRequests).toEqual([]);
});
