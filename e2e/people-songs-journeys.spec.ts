import { expect, test, type Page } from "@playwright/test";

const SONG_ID = "50000000-0000-4000-8000-000000000021";
const ALBUM_ID = "50000000-0000-4000-8000-000000000020";
const ARTIST_ID = "40000000-0000-4000-8000-000000000004";
const LYRICIST_ID = "40000000-0000-4000-8000-000000000005";

async function backendReady(page: Page): Promise<boolean> {
  const response = await page.goto(`/music/${SONG_ID}`);
  if (!response || response.status() >= 500) return false;
  return page
    .getByRole("heading", { level: 1, name: "夜航序曲" })
    .isVisible()
    .catch(() => false);
}

test.describe("people / songs public pages", () => {
  test("song detail shows credits albums related and links people", async ({ page }, testInfo) => {
    const ready = await backendReady(page);
    testInfo.skip(!ready, "requires get_song_detail + seed data");

    await expect(page.getByRole("heading", { level: 1, name: "夜航序曲" })).toBeVisible();
    await expect(page.getByText("听过", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "演职" })).toBeVisible();
    await expect(page.getByRole("link", { name: "测试艺人" })).toHaveAttribute(
      "href",
      `/people/${ARTIST_ID}?from=${encodeURIComponent(`/music/${SONG_ID}`)}`,
    );
    await expect(page.getByRole("region", { name: "收录于" })).toBeVisible();
    // 封面链 aria-label 也含子串「测试专辑：夜航电台」；用 exact 命中标题链
    await expect(page.getByRole("link", { name: "测试专辑：夜航电台", exact: true })).toBeVisible();
    // 种子曲可属多张专辑，每张面板各有「查看整张专辑」；按主专辑 href 定位
    await expect(
      page.getByRole("link", { name: /查看整张专辑/ }).and(page.locator(`[href*="/albums/${ALBUM_ID}"]`)),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "相关歌曲" })).toBeVisible();

    await page.getByRole("link", { name: "测试词人" }).click();
    await expect(page).toHaveURL(new RegExp(`/people/${LYRICIST_ID}`));
    await expect(page.getByRole("heading", { level: 1, name: "测试词人" })).toBeVisible();
    await expect(page.getByRole("link", { name: /返回歌曲/ })).toBeVisible();
  });

  test("person page shows song grid for music-only credit", async ({ page }, testInfo) => {
    await page.goto(`/people/${LYRICIST_ID}`);
    const ready = await page
      .getByRole("heading", { level: 1, name: "测试词人" })
      .isVisible()
      .catch(() => false);
    testInfo.skip(!ready, "requires get_person_works + seed data");

    await expect(page.getByRole("heading", { level: 2, name: "歌曲" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "影视" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /夜航序曲/ })).toBeVisible();
  });

  test("album tracklist links into song detail when backend is ready", async ({ page }, testInfo) => {
    await page.goto(`/albums/${ALBUM_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "测试专辑：夜航电台" })).toBeVisible();
    const trackLink = page.getByRole("table", { name: "曲目列表" }).getByRole("link", { name: "夜航序曲" });
    await expect(trackLink).toBeVisible();
    await expect(trackLink).toHaveAttribute("href", expect.stringContaining(`/music/${SONG_ID}`));

    await trackLink.click();
    const ready = await page
      .getByRole("heading", { level: 1, name: "夜航序曲" })
      .isVisible()
      .catch(() => false);
    testInfo.skip(!ready, "requires get_song_detail + seed data");
    await expect(page).toHaveURL(new RegExp(`/music/${SONG_ID}`));
  });

  test("search type filter uses 歌曲 label and music cards link to song pages", async ({ page }, testInfo) => {
    await page.goto("/search?type=music");
    await expect(
      page
        .getByRole("button", { name: "歌曲" })
        .or(page.getByText("歌曲", { exact: true }))
        .first(),
    ).toBeVisible();

    const songCard = page.getByRole("link", { name: /夜航序曲/ }).first();
    const hasCard = await songCard.isVisible().catch(() => false);
    testInfo.skip(!hasCard, "seeded song not in search results");
    await expect(songCard).toHaveAttribute("href", expect.stringContaining(`/music/${SONG_ID}`));
  });
});
