import { expect, test, type Page, type TestInfo } from "@playwright/test";

const BOOK_READING_ID = "50000000-0000-4000-8000-000000000010";
const BOOK_READ_ID = "50000000-0000-4000-8000-000000000011";
const BOOK_WANT_ID = "50000000-0000-4000-8000-000000000012";
const ALBUM_ID = "50000000-0000-4000-8000-000000000020";

/** 按断点从首页进入图书或音乐：手机走底部标签栏，平板／桌面走顶部主导航。 */
async function openCatalogFromHome(page: Page, testInfo: TestInfo, name: "图书" | "音乐", path: RegExp) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

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
  "books catalog shows stats, status filters, and reading sections",
  /* 验证图书目录的统计卡、状态筛选标签与在读／已读／想读分栏。 */ async ({ page }) => {
    await page.goto("/books");
    await expect(page.getByRole("heading", { name: "图书", exact: true })).toBeVisible();

    await expect(page.getByRole("link", { name: /图书总数量/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^在读/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /读过的书/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^想读/ })).toBeVisible();
    await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

    const filters = page.getByRole("tablist", { name: "阅读状态筛选" });
    await expect(filters.getByRole("tab", { name: "全部" })).toHaveAttribute("aria-selected", "true");
    await expect(filters.getByRole("tab", { name: "想读" })).toBeVisible();
    await expect(filters.getByRole("tab", { name: "在读" })).toBeVisible();
    await expect(filters.getByRole("tab", { name: "读过" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "在读", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "我已读", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "我想读", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /测试图书：在读笔记/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /测试图书：读过篇章/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /测试图书：想读清单/ })).toBeVisible();
  },
);

test(
  "books status filter narrows sections and hides empty columns",
  /* 筛选到单一状态只保留对应分栏；其他分栏不渲染，形成该筛选下的空状态。 */ async ({ page }) => {
    await page.goto("/books");

    await page.getByRole("tab", { name: "在读" }).click();
    await expect(page.getByRole("tab", { name: "在读" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "在读", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /测试图书：在读笔记/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "我已读", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "我想读", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /测试图书：读过篇章/ })).toHaveCount(0);

    await page.getByRole("tab", { name: "读过" }).click();
    await expect(page.getByRole("link", { name: /测试图书：读过篇章/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /测试图书：在读笔记/ })).toHaveCount(0);

    await page.getByRole("tab", { name: "想读" }).click();
    await expect(page.getByRole("link", { name: /测试图书：想读清单/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "在读", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "我已读", exact: true })).toHaveCount(0);
  },
);

test(
  "book detail shows author publisher pages and read status",
  /* 打开种子图书详情，验证标题、出版社／页数与三态阅读状态。 */ async ({ page }) => {
    await page.goto(`/books/${BOOK_READING_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "测试图书：在读笔记" })).toBeVisible();
    await expect(page.getByText("测试出版社")).toBeVisible();
    await expect(page.getByText("280")).toBeVisible();
    await expect(page.getByRole("group", { name: "阅读状态" })).toBeVisible();
    await expect(page.getByRole("status", { name: "在读" })).toHaveAttribute("aria-current", "true");

    await page.goto(`/books/${BOOK_READ_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "测试图书：读过篇章" })).toBeVisible();
    await expect(page.getByRole("status", { name: "读过" })).toHaveAttribute("aria-current", "true");

    await page.goto(`/books/${BOOK_WANT_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "测试图书：想读清单" })).toBeVisible();
    await expect(page.getByRole("status", { name: "想读" })).toHaveAttribute("aria-current", "true");
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
  /* 专辑夹具在构建后载入，目录 ISR 仍烘焙空状态文案。 */ async ({ page }) => {
    await page.goto("/albums");
    await expect(page.getByRole("heading", { name: "专辑", exact: true })).toBeVisible();
    await expect(page.getByText("还没有专辑。")).toBeVisible();
    await expect(page.getByRole("list", { name: "专辑封面墙" })).toHaveCount(0);
  },
);

test(
  "album detail renders track list with titles and listen status",
  /* 打开构建后载入的种子专辑详情，验证曲目表、曲名与收听状态。 */ async ({ page }) => {
    await page.goto(`/albums/${ALBUM_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "测试专辑：夜航电台" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "曲目" })).toBeVisible();
    await expect(page.getByRole("table", { name: "曲目列表" })).toBeVisible();
    await expect(page.getByText("夜航序曲")).toBeVisible();
    await expect(page.getByText("回港信号")).toBeVisible();
    await expect(page.getByText("听过")).toBeVisible();
    await expect(page.getByText("想听")).toBeVisible();
    await expect(page.getByText("3:30")).toBeVisible();
    await expect(page.getByText("3:05")).toBeVisible();
  },
);
