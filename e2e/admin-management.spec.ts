import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

/** 只在本地 Supabase 中验证完整管理流程；绝不对生产创建测试账号或媒体。 */
test("站长初始化、影视季集管理、公开更新、退出与非站长拒绝", async ({ page }, info) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isLocal = url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  test.skip(info.project.name !== "desktop" || !isLocal || !secret, "完整写入测试只运行于配置了运维密钥的本地 Supabase 桌面项目。");
  test.setTimeout(120_000);
  const db = createClient(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } });
  const prefix = `Admin E2E ${randomUUID()}`;
  const userIds: string[] = [];
  const ownerEmail = `${randomUUID()}@admin-e2e.invalid`;
  const outsiderEmail = `${randomUUID()}@admin-e2e.invalid`;

  /** 使用一次性初始化链接建立真实 SSR Cookie 会话；不模拟设备 Passkey 验证。 */
  async function initialize(email: string) {
    const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
    expect(error).toBeNull();
    await page.goto(`/auth/confirm?${new URLSearchParams({ type: "magiclink", token_hash: data.properties!.hashed_token })}`);
  }
  /** 提交表单并从保存后的地址取得实际媒体 ID。 */
  async function save() {
    const title = await page.getByLabel("标题", { exact: true }).inputValue();
    const [response] = await Promise.all([
      page.waitForResponse(/* 等待本次 Server Action 响应，不能把上次保存提示当作成功。 */ response => response.request().method() === "POST" && response.url().includes("/admin/media/")),
      page.getByRole("button", { name: "保存资料", exact: true }).click(),
    ]);
    expect(response.ok()).toBe(true);
    // RSC 响应可能持续流式传输；用本次实际写入和页面完成状态确认保存。
    let savedId = "";
    await expect.poll(async () => {
      const { data, error } = await db.from("media_items").select("id").eq("title", title).single();
      expect(error).toBeNull();
      savedId = data?.id ?? "";
      return savedId;
    }).not.toBe("");
    await expect(page).toHaveURL(new RegExp(`/admin/media/${savedId}\\?saved=1$`));
    await expect(page.getByRole("button", { name: "保存资料", exact: true })).toBeEnabled();
    await expect(page.getByRole("status").filter({ hasText: "保存成功" })).toBeVisible();
    return savedId;
  }
  try {
    for (const email of [ownerEmail, outsiderEmail]) {
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
      expect(error).toBeNull();
      userIds.push(data.user!.id);
    }
    const owner = await db.from("site_owner").insert({ user_id: userIds[0] });
    expect(owner.error).toBeNull();
    await initialize(ownerEmail);
    await expect(page.getByRole("heading", { name: "Passkey 设置" })).toBeVisible();

    await page.goto("/admin/media/new");
    await page.getByLabel("标题", { exact: true }).fill(`${prefix} movie`);
    await page.getByLabel("观看状态").selectOption("watched");
    await page.getByLabel("评分（0–10，可留空）").fill("8.5");
    await page.getByLabel("类型标签").fill(`${prefix} genre`);
    const movie = await save();
    await page.getByLabel("标题", { exact: true }).fill(`${prefix} updated movie`);
    await page.getByLabel("评分（0–10，可留空）").fill("0");
    await save();
    await page.goto(`/movies/${movie}`);
    await expect(page.getByRole("heading", { name: `${prefix} updated movie`, exact: true })).toBeVisible();
    const tracking = await db.from("tracking").select("status,rating").eq("media_item_id", movie).single();
    expect(tracking.data).toMatchObject({ status: "watched", rating: 0 });

    await page.goto("/admin/media/new?type=tv_series");
    await page.getByLabel("标题", { exact: true }).fill(`${prefix} series`);
    const series = await save();
    await page.getByRole("link", { name: "新增季", exact: true }).click();
    await page.getByLabel("标题", { exact: true }).fill(`${prefix} season`);
    await page.getByLabel("季编号（特别篇可填 0）").fill("1");
    const season = await save();
    await page.getByRole("link", { name: "新增集", exact: true }).click();
    await page.getByLabel("标题", { exact: true }).fill(`${prefix} episode`);
    await page.getByLabel("集编号", { exact: true }).fill("1");
    await page.getByLabel("观看状态").selectOption("watched");
    const episode = await save();
    await page.goto(`/admin/media/${series}`);
    await page.getByLabel("输入完整标题以确认删除").fill("incorrect title");
    await page.getByRole("button", { name: "永久删除", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "标题不匹配" })).toBeVisible();
    await page.getByLabel("输入完整标题以确认删除").fill(`${prefix} series`);
    await page.getByRole("button", { name: "永久删除", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\?deleted=1$/);
    const descendants = await db.from("media_items").select("id").in("id", [series, season, episode]);
    expect(descendants.error).toBeNull();
    expect(descendants.data).toEqual([]);
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
    await initialize(outsiderEmail);
    await expect(page).toHaveURL(/\/login\?error=access$/);
  } finally {
    const cleanup = await db.from("media_items").delete().like("title", `${prefix}%`);
    expect(cleanup.error).toBeNull();
    const genreCleanup = await db.from("genres").delete().eq("name", `${prefix} genre`);
    expect(genreCleanup.error).toBeNull();
    for (const id of userIds) {
      const { error } = await db.auth.admin.deleteUser(id);
      expect(error).toBeNull();
    }
  }
});
