import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/0" },
      body: "[]",
    });
  });
  await page.route("**/api/media**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rows: [], total: 0 }),
    });
  });
});

test("search page navigation matches the current responsive breakpoint", async ({ page }, testInfo) => {
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

test("navbar search preserves non-ASCII query text", async ({ page }) => {
  await page.goto("/search");
  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  if (await menuButton.isVisible()) await menuButton.click();

  const search = page.locator("nav").getByPlaceholder("搜索").filter({ visible: true });
  await search.fill("沙丘");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=%E6%B2%99%E4%B8%98$/);
});
