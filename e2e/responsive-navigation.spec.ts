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

test("search page navigation matches the current responsive breakpoint", /* 按桌面或移动断点验证导航菜单的可见性和开关行为。 */ async ({ page }, testInfo) => {
  await page.goto("/search");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("nav")).toBeVisible();

  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  if (testInfo.project.name === "desktop") {
    await expect(menuButton).toBeHidden();
    await expect(page.locator("nav").getByRole("link", { name: "电影" }).first()).toBeVisible();
  } else {
    await expect(menuButton).toBeVisible();
  }
});

test("navbar search preserves non-ASCII query text", /* 验证导航栏搜索能保留非 ASCII 关键词并正确跳转。 */ async ({ page }) => {
  await page.goto("/search");
  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  if (await menuButton.isVisible()) await menuButton.click();

  const search = page.locator("nav").getByPlaceholder("搜索").filter({ visible: true });
  await search.fill("沙丘");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=%E6%B2%99%E4%B8%98$/);
});
