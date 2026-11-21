import { expect, test, type Page, type TestInfo } from "@playwright/test";

const axePath = require.resolve("axe-core/axe.min.js");

const MOVIE_ID = "50000000-0000-4000-8000-000000000001";
const SERIES_ID = "50000000-0000-4000-8000-000000000002";
const SEASON_ID = "50000000-0000-4000-8000-000000000003";

const BOOK_ID = "50000000-0000-4000-8000-000000000010";
const ALBUM_ID = "50000000-0000-4000-8000-000000000020";

const routes = [
  { name: "首页", path: "/" },
  { name: "电影目录", path: "/movies" },
  { name: "电视节目目录", path: "/shows" },
  { name: "图书目录", path: "/books" },
  { name: "专辑目录", path: "/albums" },
  { name: "搜索", path: "/search" },
  { name: "电影详情", path: `/movies/${MOVIE_ID}` },
  { name: "电视节目详情", path: `/shows/${SERIES_ID}` },
  { name: "季度详情", path: `/shows/${SERIES_ID}/seasons/${SEASON_ID}` },
  { name: "图书详情", path: `/books/${BOOK_ID}` },
  { name: "专辑详情", path: `/albums/${ALBUM_ID}` },
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
  const results = await page.evaluate(
    /* 在浏览器内运行 axe 的 WCAG 2.0、2.1 和 2.2 AA 相关规则。 */ async () => {
      const axe = (
        window as unknown as Window & {
          axe: {
            run: (context: Document, options: object) => Promise<{ violations: AxeViolation[] }>;
          };
        }
      ).axe;

      return axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      });
    },
  );

  if (results.violations.length > 0) {
    await testInfo.attach("axe-accessibility-results", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
  }

  return results.violations;
}

for (const route of routes) {
  test(
    `${route.name}没有可自动检测的 WCAG A/AA 问题`,
    /* 访问指定路由，等待页面稳定后断言自动无障碍扫描没有违规项。 */ async ({ page }, testInfo) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main")).toBeVisible();

      expect(await scanPage(page, testInfo)).toEqual([]);
    },
  );
}

test(
  "键盘用户可以跳到主要内容",
  /* 用 Tab 和 Enter 验证跳到主要内容链接可以获得并转移焦点。 */ async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: "跳到主要内容" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  },
);

test(
  "手机底部标签栏可以完全使用键盘操作",
  /* 在手机布局中用键盘聚焦底部标签栏的电影入口并跳转，验证当前栏目标记。 */ async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "底部标签栏仅在手机宽度出现");
    await page.goto("/");

    const tabBar = page.getByRole("navigation", { name: "底部导航" });
    const moviesLink = tabBar.getByRole("link", { name: "电影" });
    await moviesLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/movies$/);
    await expect(tabBar.getByRole("link", { name: "电影" })).toHaveAttribute("aria-current", "page");
  },
);

test(
  "搜索筛选按钮的 aria-controls 在收起和展开时都指向存在的元素",
  /* 收起时面板仍挂在 DOM 且真正隐藏，展开后可见；aria-controls 始终可解析。 */ async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");

    const panel = page.locator("#search-filters");
    const toggle = page.getByRole("button", { name: /^筛选(\s\(\d+\))?$/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const collapsedControls = await toggle.getAttribute("aria-controls");
    expect(collapsedControls).toBe("search-filters");
    await expect(panel).toHaveCount(1);
    await expect(panel).toBeHidden();

    await toggle.click();
    const expanded = page.getByRole("button", { name: "收起筛选" });
    await expect(expanded).toHaveAttribute("aria-expanded", "true");
    const expandedControls = await expanded.getAttribute("aria-controls");
    expect(expandedControls).toBe(collapsedControls);
    await expect(panel).toBeVisible();

    await expanded.click();
    const collapsedAgain = page.getByRole("button", { name: /^筛选(\s\(\d+\))?$/ });
    await expect(collapsedAgain).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(`#${await collapsedAgain.getAttribute("aria-controls")}`)).toHaveCount(1);
    await expect(panel).toBeHidden();
  },
);

test(
  "搜索页标题层级连续且首屏海报优先加载",
  /* 验证搜索结果 h1→h2 连续，首张海报 preload + fetchpriority=high，其余首屏 eager，更下方懒加载。 */ async ({
    page,
  }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");

    const headings = page.getByRole("heading");
    const levels = await headings.evaluateAll((nodes) =>
      nodes.map((node) => Number(node.tagName.slice(1))).filter((level) => level >= 1 && level <= 6),
    );
    expect(levels.length).toBeGreaterThan(0);
    expect(levels[0]).toBe(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1);
    }

    const posters = page.locator(".search-media-card img");
    const count = await posters.count();
    test.skip(count === 0, "无带海报的搜索结果时跳过图片优先级断言");

    await expect(posters.first()).toHaveAttribute("fetchpriority", "high");
    if (count > 1) {
      await expect(posters.nth(1)).toHaveAttribute("loading", "eager");
    }

    // Cards past the above-the-fold window defer the img node until near the
    // viewport; assert the deferred marker instead of loading=lazy on a missing img.
    const cards = page.locator(".search-media-card");
    const cardCount = await cards.count();
    if (cardCount > 6) {
      await expect(cards.nth(6).locator("[data-poster-deferred='true']")).toHaveCount(1);
      await expect(cards.nth(6).locator("img")).toHaveCount(0);
    }

    const sizes = await posters.first().getAttribute("sizes");
    expect(sizes ?? "").toMatch(/\d+px/);
    expect(sizes ?? "").not.toMatch(/\dvw\b/);
  },
);

test(
  "电视节目详情页导演链接触控目标足够大",
  /* 验证导演搜索链接至少 24×24 CSS 像素，触控高度接近 44px。 */ async ({ page }) => {
    await page.goto(`/shows/${SERIES_ID}`);
    await page.waitForLoadState("networkidle");

    const director = page.locator('a[href*="creditRole=director"]').first();
    test.skip((await director.count()) === 0, "种子剧集无导演链接时跳过");

    const box = await director.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(24);
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  },
);
