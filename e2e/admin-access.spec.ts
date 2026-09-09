import { expect, test } from "@playwright/test";

/** 未登录访问任何管理入口都必须回到登录页。 */
test("管理区拒绝匿名访问，登录页无注册和邮箱输入", async ({ page }) => {
  await page.goto("/admin/media/new");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "站长登录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "使用 Passkey 登录" })).toBeVisible();
  await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: /注册|register/i })).toHaveCount(0);
  expect(await page.evaluate(/* 检查窄屏无横向溢出。 */ () => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

/** 无效的一次性链接不能建立会话或重定向到外部地址。 */
test("无效初始化链接回到登录页", async ({ page, baseURL }) => {
  await page.goto("/auth/confirm?type=signup&token_hash=invalid&next=https://example.com");
  await expect(page).toHaveURL(/\/login\?error=link$/);
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
  await expect(page.getByRole("alert").filter({ hasText: "登录链接无效或已过期" })).toBeVisible();
});
