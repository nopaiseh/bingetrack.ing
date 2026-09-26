import { expect, test } from "@playwright/test";

test.beforeEach(/* 在每个响应式导航测试前模拟空数据库与搜索结果，隔离真实数据依赖。 */ async ({ page }) => {
  await page.route("**/rest/v1/**", /* 返回带空行数头的空 PostgREST 响应。 */ async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/0" },
      body: "[]",
    });
  });
  await page.route("**/api/media**", /* 为搜索 API 返回空卡片列表和零总数。 */ async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rows: [], total: 0 }),
    });
  });
});

test("search page navigation matches the current responsive breakpoint", /* 按断点验证顶部栏目链接与底部标签栏的可见性。 */ async ({ page }, testInfo) => {
  await page.goto("/search");
  await page.waitForLoadState("networkidle");
  const mainNav = page.getByRole("navigation", { name: "主要导航" });
  await expect(mainNav).toBeVisible();

  const tabBar = page.getByRole("navigation", { name: "底部导航" });
  await expect(page.getByRole("button", { name: "打开导航菜单" })).toHaveCount(0);
  if (testInfo.project.name === "phone") {
    // 768px 以下顶部只保留登录，栏目与搜索由底部标签栏承担。
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole("link", { name: "搜索" })).toHaveAttribute("aria-current", "page");
    await expect(mainNav.getByRole("link", { name: "电影" })).toBeHidden();
  } else {
    // 平板与桌面直接在顶部展示栏目链接。
    await expect(tabBar).toBeHidden();
    await expect(mainNav.getByRole("link", { name: "电影" })).toBeVisible();
  }
});

test("navbar search preserves non-ASCII query text", /* 验证导航栏搜索能保留非 ASCII 关键词并正确跳转。 */ async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "768px 以下顶部不含搜索框，经底部标签栏进入搜索页");
  await page.goto("/search");
  const mainNav = page.getByRole("navigation", { name: "主要导航" });
  const search = mainNav.getByPlaceholder("搜索").filter({ visible: true });
  await search.fill("沙丘");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=%E6%B2%99%E4%B8%98$/);
});
