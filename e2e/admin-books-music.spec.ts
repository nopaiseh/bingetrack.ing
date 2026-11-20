import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/** 只在本地 Supabase 中验证图书／音乐管理流程；绝不对生产创建测试账号或媒体。 */
function requireLocalAdmin(info: { project: { name: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isLocal = url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  test.skip(
    info.project.name !== "admin" || !isLocal || !secret,
    "完整写入测试只运行于配置了运维密钥的本地 Supabase 管理项目。",
  );
  return { url: url!, secret: secret! };
}

/** 使用一次性初始化链接建立真实 SSR Cookie 会话；不模拟设备 Passkey 验证。 */
async function initializeOwner(page: Page, db: SupabaseClient, email: string) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  expect(error).toBeNull();
  await page.goto(
    `/auth/confirm?${new URLSearchParams({ type: "magiclink", token_hash: data.properties!.hashed_token })}`,
  );
  await page.getByRole("button", { name: "Continue / 继续登录" }).click();
}

/** 提交表单并从保存后的地址／数据库取得实际媒体 ID。 */
async function saveMedia(page: Page, db: SupabaseClient, title: string) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/manage/media/"),
      { timeout: 15_000 },
    ),
    page.getByRole("button", { name: "保存", exact: true }).click(),
  ]);
  expect(response.ok()).toBe(true);
  let savedId = "";
  await expect
    .poll(
      async () => {
        const { data, error } = await db.from("media_items").select("id").eq("title", title).single();
        expect(error).toBeNull();
        savedId = data?.id ?? "";
        return savedId;
      },
      { timeout: 15_000 },
    )
    .not.toBe("");
  await expect(page).toHaveURL(new RegExp(`/manage/media/${savedId}\\?saved=1&n=\\d+$`));
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存", exact: true })).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: "保存成功" })).toBeVisible();
  return savedId;
}

async function createOwner(db: SupabaseClient) {
  const email = `${randomUUID()}@admin-e2e.invalid`;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  expect(error).toBeNull();
  const userId = data.user!.id;
  // 单人站长表：先清空再写入，避免与并行管理测试抢唯一行。
  expect((await db.from("site_owner").delete().neq("singleton", false)).error).toBeNull();
  expect((await db.from("site_owner").insert({ user_id: userId })).error).toBeNull();
  return { email, userId };
}

test.describe.configure({ mode: "serial" });

test("后台新建图书出现在列表，可编辑后删除", async ({ page }, info) => {
  const { url, secret } = requireLocalAdmin(info);
  test.setTimeout(120_000);
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const prefix = `Book E2E ${randomUUID()}`;
  const title = `${prefix} novel`;
  const renamed = `${prefix} novel revised`;
  let userId = "";

  try {
    const owner = await createOwner(db);
    userId = owner.userId;
    await initializeOwner(page, db, owner.email);
    await expect(page.getByRole("heading", { name: "Passkey 设置" })).toBeVisible();

    await page.goto("/manage/media/new?type=book");
    await page.getByLabel("中文标题", { exact: true }).fill(title);
    await page.getByLabel("出版社").fill(`${prefix} Press`);
    await page.getByLabel("页数").fill("320");
    await page.getByLabel("评分（0–10，可留空）").fill("8.5");
    const bookId = await saveMedia(page, db, title);

    await page.goto(`/manage?type=book&q=${encodeURIComponent(prefix)}`);
    await expect(
      page.getByRole("list", { name: "图书列表" }).getByRole("checkbox", { name: `选择 ${title}` }),
    ).toBeVisible();

    await page.goto(`/manage/media/${bookId}?type=book`);
    await page.getByLabel("中文标题", { exact: true }).fill(renamed);
    await saveMedia(page, db, renamed);

    await page.getByRole("button", { name: "删除这本图书…", exact: true }).click();
    await page.getByLabel("输入完整标题以确认删除").fill(renamed);
    await page.getByRole("button", { name: "永久删除", exact: true }).click();
    await expect(page).toHaveURL(/\/manage\?type=book&deleted=1&n=\d+$/);
    const gone = await db.from("media_items").select("id").eq("id", bookId);
    expect(gone.error).toBeNull();
    expect(gone.data).toEqual([]);
  } finally {
    expect((await db.from("media_items").delete().like("title", `${prefix}%`)).error).toBeNull();
    if (userId) expect((await db.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});

test("后台新建专辑并添加曲目，可编辑曲目后删除专辑及下属曲目", async ({ page }, info) => {
  const { url, secret } = requireLocalAdmin(info);
  test.setTimeout(120_000);
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const prefix = `Music E2E ${randomUUID()}`;
  const albumTitle = `${prefix} album`;
  const trackTitle = `${prefix} track`;
  const trackRenamed = `${prefix} track revised`;
  let userId = "";
  let albumId = "";
  let trackId = "";

  try {
    const owner = await createOwner(db);
    userId = owner.userId;
    await initializeOwner(page, db, owner.email);
    await expect(page.getByRole("heading", { name: "Passkey 设置" })).toBeVisible();

    await page.goto("/manage/media/new?type=album");
    await page.getByLabel("中文标题", { exact: true }).fill(albumTitle);
    await page.getByLabel("厂牌").fill(`${prefix} Label`);
    albumId = await saveMedia(page, db, albumTitle);

    // 曲目只在专辑结构栏就地新增：连续录入关闭后留在当前专辑页。
    const rail = page.getByRole("complementary", { name: "曲目结构" });
    await rail.getByRole("button", { name: /新增第 1 首/ }).click();
    const addTrack = page.getByRole("dialog", { name: "新增曲目" });
    await expect(addTrack.getByLabel("曲序")).toHaveValue("1");
    await addTrack.getByLabel("曲名").fill(trackTitle);
    await addTrack.getByLabel("时长（秒，可留空）").fill("210");
    await addTrack.getByLabel(/保存后继续新增/).uncheck();
    await addTrack.getByRole("button", { name: "保存曲目", exact: true }).click();
    await expect(page.getByRole("heading", { name: trackTitle, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(new RegExp(`/manage/media/${albumId}\\?`));
    trackId = new URL(page.url()).pathname.split("/").at(-1)!;
    expect(trackId).not.toBe(albumId);
    const added = await db.from("music").select("media_item_id").eq("album_id", albumId).eq("track_number", 1).single();
    expect(added.error).toBeNull();
    expect(added.data!.media_item_id).toBe(trackId);

    await page.getByLabel("中文标题", { exact: true }).fill(trackRenamed);
    await saveMedia(page, db, trackRenamed);
    await expect(rail.getByRole("link", { name: new RegExp(trackRenamed) })).toBeVisible();

    await page.goto(`/manage/media/${albumId}?type=album`);
    await page.getByRole("button", { name: "删除这张专辑…", exact: true }).click();
    await page.getByLabel("输入完整标题以确认删除").fill(albumTitle);
    await page.getByRole("button", { name: "永久删除", exact: true }).click();
    await expect(page).toHaveURL(/\/manage\?type=album&deleted=1&n=\d+$/);
    const descendants = await db.from("media_items").select("id").in("id", [albumId, trackId]);
    expect(descendants.error).toBeNull();
    expect(descendants.data).toEqual([]);
    const tracksLeft = await db.from("music").select("media_item_id").eq("album_id", albumId);
    expect(tracksLeft.error).toBeNull();
    expect(tracksLeft.data).toEqual([]);
  } finally {
    expect((await db.from("media_items").delete().like("title", `${prefix}%`)).error).toBeNull();
    if (userId) expect((await db.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});
