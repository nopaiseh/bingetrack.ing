import { expect, test, type Page, type TestInfo } from "@playwright/test";

const BOOK_READING_ID = "50000000-0000-4000-8000-000000000010";
const BOOK_READ_ID = "50000000-0000-4000-8000-000000000011";
const BOOK_WANT_ID = "50000000-0000-4000-8000-000000000012";
const ALBUM_ID = "50000000-0000-4000-8000-000000000020";

/** MediaRow 分栏标题（排除统计卡里同名的小号 h2）。 */
function sectionHeading(page: Page, name: string) {
  return page.locator("h2.text-xl", { hasText: name });
}

/** 按断点从首页进入图书或音乐：手机走底部标签栏，平板／桌面走顶部主导航。 */
async function openCatalogFromHome(page: Page, testInfo: TestInfo, name: "图书" | "音乐", path: RegExp) {
  await page.goto("/");

  if (testInfo.project.name === "phone") {
    const tabBar = page.getByRole("navigation", { name: "底部导航" });
    await expect(tabBar).toBeVisible();
    await tabBar.getByRole("link", { name }).click();
  } else {
    const mainNav = page.getByRole("navigation", { name: "主要导航" });
    await expect(mainNav.getByRole("link", { name })).toBeVisible();
    await mainNav.getByRole("link", { name }).click();
  }

  await expect(page).toHaveURL(path);
}

test(
  "home or navbar navigation reaches books and albums catalogs",
  /* 从首页经导航进入图书与音乐目录，确认公开入口可用。 */ async ({ page }, testInfo) => {
    await openCatalogFromHome(page, testInfo, "图书", /\/books$/);
    await expect(page.getByRole("heading", { name: "图书", exact: true })).toBeVisible();

    await openCatalogFromHome(page, testInfo, "音乐", /\/albums$/);
    await expect(page.getByRole("heading", { name: "专辑", exact: true })).toBeVisible();
  },
);

test(
  "books catalog shows stats and reading sections without filter chips",
  /* 验证图书目录的统计卡与在读／已读／想读分栏；方案 A 已去掉筛选标签。 */ async ({ page }) => {
    await page.goto("/books");
    await expect(page.getByRole("heading", { name: "图书", exact: true })).toBeVisible();

    await expect(page.getByRole("link", { name: /图书总数量/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /读过的书/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /在读的书/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /想读的书/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /图书总数量/ })).toContainText("3");

    await expect(page.getByRole("tablist", { name: "阅读状态筛选" })).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(0);

    await expect(sectionHeading(page, "在读")).toBeVisible();
    await expect(sectionHeading(page, "我已读")).toBeVisible();
    await expect(sectionHeading(page, "我想读")).toBeVisible();
    await expect(page.getByRole("link", { name: /测试图书：在读笔记/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /测试图书：读过篇章/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /测试图书：想读清单/ })).toBeVisible();
  },
);

test(
  "book detail shows author publisher pages and read status",
  /* 打开种子图书详情，验证标题、出版社／页数与三态阅读状态。 */ async ({ page }) => {
    await page.goto(`/books/${BOOK_READING_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "测试图书：在读笔记" })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: "测试出版社" })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: "280" })).toBeVisible();
    const readingStatus = page.getByRole("group", { name: "阅读状态" });
    await expect(readingStatus).toBeVisible();
    // status 角色通常没有 accessible name，按文案断言当前态（与单元测试一致）。
    await expect(readingStatus.getByText("在读", { exact: true })).toHaveAttribute("aria-current", "true");

    await page.goto(`/books/${BOOK_READ_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "测试图书：读过篇章" })).toBeVisible();
    await expect(page.getByRole("group", { name: "阅读状态" }).getByText("读过", { exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await page.goto(`/books/${BOOK_WANT_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "测试图书：想读清单" })).toBeVisible();
    await expect(page.getByRole("group", { name: "阅读状态" }).getByText("想读", { exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );
  },
);

test(
  "books catalog links into a seeded book detail",
  /* 从图书目录卡片进入详情并核对地址。 */ async ({ page }) => {
    await page.goto("/books");
    await page.getByRole("link", { name: /测试图书：在读笔记/ }).click();
    await expect(page).toHaveURL(new RegExp(`/books/${BOOK_READING_ID}`));
    await expect(page.getByRole("heading", { level: 1, name: "测试图书：在读笔记" })).toBeVisible();
  },
);

test(
  "albums catalog empty state shows 还没有专辑。",
  /* 专辑夹具在构建后载入，目录 ISR 仍烘焙空状态文案；方案 A 不再渲染封面墙。 */ async ({ page }) => {
    await page.goto("/albums");
    await expect(page.getByRole("heading", { name: "专辑", exact: true })).toBeVisible();
    await expect(page.getByText("还没有专辑。")).toBeVisible();
    await expect(page.getByRole("link", { name: "去搜索" })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "专辑封面墙" })).toHaveCount(0);
    await expect(sectionHeading(page, "我已听")).toHaveCount(0);
    await expect(sectionHeading(page, "我在听")).toHaveCount(0);
    await expect(sectionHeading(page, "我想听")).toHaveCount(0);
  },
);

test(
  "album detail renders track list with titles and listen status",
  /* 打开构建后载入的种子专辑详情，验证曲目表、曲名与收听状态。 */ async ({ page }) => {
    await page.goto(`/albums/${ALBUM_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "测试专辑：夜航电台" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "曲目" })).toBeVisible();

    const tracklist = page.getByRole("table", { name: "曲目列表" });
    await expect(tracklist).toBeVisible();
    await expect(tracklist.getByText("夜航序曲", { exact: true })).toBeVisible();
    await expect(tracklist.getByText("回港信号", { exact: true })).toBeVisible();
    // 收听状态可能与页头文案重复，限定在曲目表内用 exact 断言。
    await expect(tracklist.getByText("听过", { exact: true })).toBeVisible();
    await expect(tracklist.getByText("想听", { exact: true })).toBeVisible();
    await expect(tracklist.getByText("3:30", { exact: true })).toBeVisible();
    await expect(tracklist.getByText("3:05", { exact: true })).toBeVisible();
  },
);
