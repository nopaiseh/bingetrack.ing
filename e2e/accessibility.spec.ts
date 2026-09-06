import { expect, test, type Page, type TestInfo } from "@playwright/test";

const axePath = require.resolve("axe-core/axe.min.js");

const MOVIE_ID = "50000000-0000-4000-8000-000000000001";
const SERIES_ID = "50000000-0000-4000-8000-000000000002";
const SEASON_ID = "50000000-0000-4000-8000-000000000003";

const routes = [
  { name: "首页", path: "/" },
  { name: "电影目录", path: "/movies" },
  { name: "电视剧目录", path: "/series" },
  { name: "搜索", path: "/search" },
  { name: "电影详情", path: `/movies/${MOVIE_ID}` },
  { name: "电视剧详情", path: `/series/${SERIES_ID}` },
  { name: "季度详情", path: `/series/${SERIES_ID}/seasons/${SEASON_ID}` },
];

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string[] }>;
};

/** 在页面注入 axe 并扫描指定 WCAG A/AA 规则；发现问题时附加报告，返回违规列表。 */
async function scanPage(page: Page, testInfo: TestInfo): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(/* 在浏览器内运行 axe 的 WCAG 2.0、2.1 和 2.2 AA 相关规则。 */ async () => {
    const axe = (window as unknown as Window & {
      axe: {
        run: (context: Document, options: object) => Promise<{ violations: AxeViolation[] }>;
      };
    }).axe;

    return axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
  });

  if (results.violations.length > 0) {
    await testInfo.attach("axe-accessibility-results", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
  }

  return results.violations;
}

for (const route of routes) {
  test(`${route.name}没有可自动检测的 WCAG A/AA 问题`, /* 访问指定路由，等待页面稳定后断言自动无障碍扫描没有违规项。 */ async ({ page }, testInfo) => {
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();

    expect(await scanPage(page, testInfo)).toEqual([]);
  });
}

test("键盘用户可以跳到主要内容", /* 用 Tab 和 Enter 验证跳到主要内容链接可以获得并转移焦点。 */ async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "跳到主要内容" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("移动导航可以完全使用键盘操作", /* 在移动布局中用键盘打开菜单并进入电影栏目，验证菜单按钮焦点和跳转地址。 */ async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "桌面导航始终可见");
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  await menuButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: "关闭导航菜单" })).toBeFocused();
  const moviesLink = page.locator("#mobile-navigation").getByRole("link", { name: "电影" });
  await moviesLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/movies$/);
});
