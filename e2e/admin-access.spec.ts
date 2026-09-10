import { expect, test } from "@playwright/test";

/** 未登录访问任何管理入口都必须回到首页导航栏。 */
test("管理区拒绝匿名访问，首页导航栏无注册和邮箱输入", async ({ page }) => {
  await page.goto("/manage/media/new");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
  await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: /注册|register/i })).toHaveCount(0);
  expect(await page.evaluate(/* 检查窄屏无横向溢出。 */ () => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

/** 无效的一次性链接不能建立会话或重定向到外部地址。 */
test("无效初始化链接回到首页导航栏", async ({ page, baseURL }) => {
  await page.goto("/auth/confirm?type=signup&token_hash=invalid&next=https://example.com");
  await expect(page).toHaveURL(/\/\?authError=link$/);
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
  await expect(page.getByRole("alert").filter({ hasText: "登录链接无效或已过期" })).toBeVisible();
});

/** 设置采用独立路由，匿名访问仍由服务端拒绝。 */
test("设置页拒绝匿名访问", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
});

/** 删除的登录与管理旧地址不再提供页面或重定向。 */
test("旧路由已删除", async ({ request }) => {
  for (const path of ["/login", "/admin", "/admin/security"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
