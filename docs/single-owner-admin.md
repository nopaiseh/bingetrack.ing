# 单人管理与 Passkey

公开页面继续匿名读取。`/admin` 和每个写入 Server Action 都先向 Supabase Auth 验证用户，再调用 `is_site_owner()` 检查固定账号。数据库使用相同的 `site_owner` 记录执行 RLS；该表只有一个槽位，普通用户不能自行写入。应用运行时不需要 service role / secret key。

第一版管理电影、剧集、季、集的新增、编辑、删除，标题、其他标题、简介、TMDB 封面、发行日期、时长、类型标签、语言、地区、导演、演员、评分和看过／没看过状态。**没有观看日期或额外进度字段。** 没看过沿用数据库已有的 `want_to_watch` 值；各集状态体现追剧进度，现有公开页面的汇总规则不变。

## 部署顺序

1. `single-owner-admin.sql` 已于 2026-09-09 应用到生产，作为迁移记录保留，不要重复执行。`current_schema.sql` 已同步这些结构；本地重建和 CI 只需载入当前快照，再载入测试数据。
2. 部署包含 `/login`、`/auth/confirm`、`/admin` 的应用。公开 Supabase URL 和 anon key 沿用原配置，`@supabase/ssr` 已锁定版本。
3. 在 Supabase Authentication 关闭新用户注册、匿名登录及不使用的登录提供商；启用 Passkey。RP display name 为 `bingetrack.ing`，RP ID 为 `bingetrack.ing`，Origins 仅列实际需要的 `https://bingetrack.ing` 和 `https://www.bingetrack.ing`。Site URL 设置为实际规范域名。RP ID 绑定后保持不变。Vercel 随机 Preview 域名不使用生产 Passkey。
4. 用下述运维工具为站长指定的邮箱创建唯一账号并生成初始化链接；工具不发送邮件。邮箱确认由站长通过后台信任流程完成，首次创建没有密码。真实邮箱只放在被忽略的本地配置中。
5. 站长亲自打开一次性链接，进入 Passkey 设置，完成 Touch ID / Face ID / 密码管理器验证。建议添加两个独立凭证，退出后分别验证登录。
6. 验证匿名仍可浏览、站长 CRUD 生效、其他账号无法直接写表或调用 RPC、退出和会话刷新正常。真实设备验证必须由站长完成，自动化测试不代表生产 Passkey 已绑定成功。

Supabase 原生 Passkey 当前为 Experimental，SDK/API 升级时需重新验证注册、登录、重命名和移除流程。

## 初始化与恢复工具

在项目根目录创建被 Git 忽略的 `.env.admin`，权限设为 `600`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=你的项目URL
NEXT_PUBLIC_SITE_URL=https://www.bingetrack.ing
OWNER_EMAIL=你的站长邮箱
SUPABASE_SECRET_KEY=仅用于本地运维的SupabaseSecretKey
```

不要把密钥发到聊天中，也不要放入任何 `NEXT_PUBLIC_` 变量。日常应用无需该密钥。首次执行：

```sh
node --env-file=.env.admin scripts/prepare-owner-login.mjs --create
```

工具只会指定该邮箱对应的 user ID，拒绝替换已有站长。链接保存在被忽略的 `.local-admin/login-link.txt`，文件权限 `600`。打开链接绑定 Passkey，完成后删除该文件。链接无需发送邮件，不需要 SMTP；它是临时登录凭证，不应粘贴到聊天、提交到 Git 或上传到日志。

凭证全部丢失时，站长通过持有 Supabase 后台权限的本地运维流程重新生成链接：

```sh
node --env-file=.env.admin scripts/prepare-owner-login.mjs
```

恢复模式不会创建新账号或指定新站长。普通访客没有邮箱登录表单或恢复接口。添加新凭证需要已登录账号；UI 禁止移除最后一个凭证，移除前重新做 Passkey 验证。Supabase 自身的凭证管理 API 仍由该用户会话授权，UI 的最后凭证保护并非服务端数量约束。

## 本地与 CI

本地 Supabase 配置已关闭注册，并启用 `localhost` RP。绑定测试凭证时使用 `http://localhost:3000`，不能用生产项目或 `127.0.0.1` 凭证代替。公开 E2E 仍可使用原有 `127.0.0.1` 地址。

数据库重建顺序：`current_schema.sql` → `fixtures/e2e_seed.sql`。CI 执行 `supabase test db`，包含账号隔离、原子保存、重复编号回滚、完整树删除和公开读取的 pgTAP 测试。测试账号和数据只存在于回滚事务。

管理页使用私有、不可共享的会话响应；公开数据仍使用原公开客户端。成功保存／删除后失效 `media` 标签并重新验证页面布局。已在 CDN 缓存的公开 API 响应可能按现有的 30–60 秒 TTL 和 stale-while-revalidate 窗口短暂保留旧结果；已打开的其他浏览器也需要刷新。

## 删除与关联

删除需要输入完整标题。删除剧集同时移除其季、集、观看记录和评分；删除季同时移除该季各集。数据库事务收集全部后代的 `media_items` 后一起删除，避免仅删除外键关系而残留媒体。标签、语言、地区和人物词条本身保留，避免影响其他媒体。当前编辑表单不改变音乐、书籍及其他人物角色。

## 本次验证记录

- 本地 Node 26.5.0：ESLint、TypeScript、79 个 Vitest 测试及 `next build --webpack` 通过。项目和 CI 仍要求 Node 22，本次未执行远程 CI。
- Playwright：手机、平板、桌面共 6 个匿名访问／无效初始化链接测试通过；浏览器查看登录页无运行错误。
- 本地 PGlite PostgreSQL 引擎：33 项管理 SQL 断言通过，涵盖 RLS、事务回滚、关联保存和完整删除。测试加载实际结构和扩展脚本，省略 pg_trgm 扩展／索引，并以轻量断言函数执行 pgTAP 用例；不等同于完整 Supabase 环境的 pgTAP 执行。
- 线上仅用 anon 权限验证电影、季、集的关联读取与编号排序，全部成功；未执行任何写入或 Auth 配置变更。
- `e2e/admin-management.spec.ts` 已加入完整初始化、影视季集增删改、公开页面更新、退出和非站长拒绝的测试，仅允许本地 Supabase 的桌面项目运行。本机未运行该写入流程。
- 2026-09-09：生产迁移已应用；已创建并确认唯一站长账号，站长表和 Auth 用户数均为 1。生产只读事务确认站长身份通过、其他身份拒绝、匿名公开读取正常，anon 无写权限。Passkey 已启用，RP ID 为 `bingetrack.ing`，允许根域和 www 的 HTTPS 来源；已关闭公开注册，匿名登录保持关闭。
- 安全 Advisor 未报告数据库问题；仅有未启用泄漏密码保护的 Auth 提示，当前站长账号未设置密码。
- 应用尚未部署，真实 Passkey 尚未绑定。一次性初始化链接只存放于本地受限文件；应在网站部署后重新生成，避免链接过期。
