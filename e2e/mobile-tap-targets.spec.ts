import { expect, test, type Locator } from "@playwright/test";

const SERIES_ID = "50000000-0000-4000-8000-000000000002";
const SEASON_ID = "50000000-0000-4000-8000-000000000003";

/**
 * 读取控件的有效点击面：元素自身盒子与 ::before 伪元素（Option A 隐形热区）取较大值。
 */
async function effectiveHitSize(locator: Locator): Promise<{ width: number; height: number }> {
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const before = getComputedStyle(el, "::before");
    const beforeWidth = parseFloat(before.width);
    const beforeHeight = parseFloat(before.height);
    return {
      width: Math.max(rect.width, Number.isFinite(beforeWidth) ? beforeWidth : 0),
      height: Math.max(rect.height, Number.isFinite(beforeHeight) ? beforeHeight : 0),
    };
  });
}

test.describe("手机点击范围 ≥40px（第 27 项）", () => {
  test.beforeEach(
    /* 仅在 390px 手机项目断言热区；平板与桌面跳过。 */ async ({}, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "仅在 390px 手机视口检查点击范围");
    },
  );

  test(
    "顶栏登录／管理按钮点击面至少 40×40",
    /* 测量导航栏右侧登录（及可见时的管理）热区。 */ async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const mainNav = page.getByRole("navigation", { name: "主要导航" });
      const login = mainNav.getByRole("button", { name: "登录" });
      await expect(login).toBeVisible();

      const loginHit = await effectiveHitSize(login);
      expect(loginHit.width).toBeGreaterThanOrEqual(40);
      expect(loginHit.height).toBeGreaterThanOrEqual(40);

      const manage = mainNav.getByRole("link", { name: "管理" });
      if ((await manage.count()) > 0 && (await manage.isVisible())) {
        const manageHit = await effectiveHitSize(manage);
        expect(manageHit.width).toBeGreaterThanOrEqual(40);
        expect(manageHit.height).toBeGreaterThanOrEqual(40);
      }
    },
  );

  test(
    "搜索清除按钮点击面至少 40×40",
    /* 输入关键词后测量清除（×）按钮的隐形热区。 */ async ({ page }) => {
      await page.route(
        "**/api/media**",
        /* 返回空结果，避免依赖真实搜索数据。 */ async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ rows: [], total: 0 }),
          });
        },
      );

      await page.goto("/search");
      await page.waitForLoadState("networkidle");
      await page.getByRole("textbox", { name: "搜索媒体" }).fill("测试");

      const clear = page.getByRole("button", { name: "清除搜索" });
      await expect(clear).toBeVisible();
      const hit = await effectiveHitSize(clear);
      expect(hit.width).toBeGreaterThanOrEqual(40);
      expect(hit.height).toBeGreaterThanOrEqual(40);
    },
  );

  test(
    "季页筛选与排序芯片点击面 ≥40×40，且排序与同排筛选对齐",
    /* 断言全部／已看／未看／升序热区，并核对升序与筛选同高同顶。 */ async ({ page }) => {
      await page.goto(`/shows/${SERIES_ID}/seasons/${SEASON_ID}`);
      await page.waitForLoadState("networkidle");

      const bar = page.getByTestId("season-filter-bar");
      await expect(bar).toBeVisible();

      const all = bar.getByRole("link", { name: "全部", exact: true });
      const watched = bar.getByRole("link", { name: "已看", exact: true });
      const unwatched = bar.getByRole("link", { name: "未看", exact: true });
      const sort = bar.getByTestId("season-sort-toggle");

      for (const chip of [all, watched, unwatched, sort]) {
        await expect(chip).toBeVisible();
        const hit = await effectiveHitSize(chip);
        expect(hit.width).toBeGreaterThanOrEqual(40);
        expect(hit.height).toBeGreaterThanOrEqual(40);
      }

      const allBox = await all.boundingBox();
      const watchedBox = await watched.boundingBox();
      const unwatchedBox = await unwatched.boundingBox();
      const sortBox = await sort.boundingBox();
      expect(allBox).not.toBeNull();
      expect(watchedBox).not.toBeNull();
      expect(unwatchedBox).not.toBeNull();
      expect(sortBox).not.toBeNull();

      // 视觉盒子（不含伪元素扩张）与同排筛选对齐：同高、同顶。
      expect(sortBox!.height).toBeCloseTo(allBox!.height, 0);
      expect(sortBox!.height).toBeCloseTo(watchedBox!.height, 0);
      expect(sortBox!.height).toBeCloseTo(unwatchedBox!.height, 0);
      expect(sortBox!.y).toBeCloseTo(allBox!.y, 0);
      expect(sortBox!.y).toBeCloseTo(watchedBox!.y, 0);
      expect(sortBox!.y).toBeCloseTo(unwatchedBox!.y, 0);
    },
  );
});
