# 单人管理与 Passkey

网站只有一个管理员（站长）。公开页面匿名读取；`/manage`、`/settings` 和每个写入用的 Server Action 都会先向 Supabase Auth 验证用户，再调用 `is_site_owner()` 核对是否为站长（`lib/auth/server.ts` 的 `requireOwner`）。数据库的 RLS 使用同一张 `site_owner` 表：这张表只有一个槽位，普通用户不能写入。网站运行时不需要 service role 或 secret key。

## 认证方式

- 登录只用 Passkey（Supabase 原生 Passkey，目前是 Experimental）。没有公开注册、邮箱登录表单或找回密码接口。
- 首次绑定和凭证全部丢失后的恢复，都由站长在本地用运维工具生成一次性登录链接，经 `/auth/confirm` 登录后进入 `/settings` 绑定 Passkey。
- `/settings` 管理凭证：添加、重命名、移除，显示每个凭证的最后使用日期。界面不允许移除最后一个凭证，移除前要重新做一次 Passkey 验证。注意这只是界面保护，Supabase 的凭证 API 本身仍由该用户会话授权，服务端没有数量约束。
- 登录状态在浏览器端维护：30 分钟无操作自动登出，多个标签页共享活动时间（`lib/auth/idle.ts`）。
- 退出通过 `POST /auth/logout`；`GET` 只会跳回首页，防止链接预取或跨站图片把站长登出。
- `proxy.ts` 只为 `/manage`、`/settings`、`/auth` 刷新会话，并给这些响应加 `Cache-Control: private, no-store`。公开页面不读 Cookie，也就不会把会话写进公开缓存。
- `/auth/dev-login` 只在 `next dev` 下可用，生产构建一律返回 404。

## 首次上线步骤

1. 用 `supabase db push` 应用迁移（单人管理所需的结构已包含在基线迁移中），然后部署应用。
2. 在 Supabase Authentication 中：
   - 关闭新用户注册、匿名登录和所有不用的登录方式，启用 Passkey。
   - RP display name 填 `bingetrack.ing`，RP ID 填 `bingetrack.ing`；Origins 只列 `https://bingetrack.ing` 和 `https://www.bingetrack.ing`。
   - Site URL 设为正式域名。
   - RP ID 绑定之后不要再改，否则已有凭证全部失效。Vercel 的随机预览域名不能使用生产 Passkey。
3. 用下面的运维工具创建站长账号并生成初始化链接。工具不发邮件，站长邮箱只写在本地被忽略的配置里。
4. 站长亲自打开链接，在 `/settings` 用 Touch ID / Face ID / 密码管理器完成绑定。建议绑定两个独立的凭证，退出后分别验证能否登录。
5. 验证：匿名访客能正常浏览；站长能增删改；其他账号不能直接写表或调用 RPC；退出与会话刷新正常。真实设备上的验证必须由站长本人完成，自动化测试不能代替。

Supabase SDK 或 API 升级后，要重新验证 Passkey 的注册、登录、重命名和移除流程。

## 初始化与恢复工具

在根目录的 `.env.local` 里补充以下变量（保留其他已有变量），文件权限设为 `600`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=你的项目 URL
NEXT_PUBLIC_SITE_URL=https://www.bingetrack.ing
OWNER_EMAIL=站长邮箱
SUPABASE_SECRET_KEY=仅用于本地运维的 Supabase secret key
```

不要把密钥发到聊天里，也不要放进任何 `NEXT_PUBLIC_` 变量。

首次初始化（创建账号并指定站长）：

```sh
npm run owner:login -- --create
```

工具只会把该邮箱对应的用户 ID 设为站长，已有站长时拒绝替换。

凭证全部丢失时重新生成登录链接（不会创建新账号，也不会更换站长）：

```sh
npm run owner:login
```

链接写入被忽略的 `.local-admin/login-link.txt`（权限 `600`）。它是临时登录凭证：不需要 SMTP，不要粘贴到聊天、提交到 Git 或出现在日志里，用完立即删除该文件。

## 本地开发与 CI

- 本地 Supabase 配置已关闭注册，并启用 `localhost` 作为 RP。绑定测试凭证要用 `http://localhost:3000`，不能用 `127.0.0.1` 或生产项目的凭证代替；公开页面的 E2E 仍可使用 `127.0.0.1`。
- 本地开发可以访问 `/auth/dev-login` 直接以 `OWNER_EMAIL` 登录，需要在 `.env.local` 配置 `OWNER_EMAIL` 和 `SUPABASE_SECRET_KEY`（或本地的 `SUPABASE_SERVICE_ROLE_KEY`）。
- CI 运行 `supabase test db`，覆盖账号隔离、原子保存、重复编号回滚、整棵树删除和公开读取。测试账号和数据只存在于回滚的事务里。

## 保存后的缓存刷新

管理页的响应都是私有、不缓存的；公开页面继续用匿名客户端和公开缓存。

保存或删除成功后，只让受影响的条目失效：条目本身、所属电视节目、同系列作品，加上首页、目录页和站点地图。修改人物、类型等关联资料或执行批量清理时，影响面难以界定，会让全站缓存失效。完整规则见 [缓存与 Vercel 写入用量](caching.md)。

公开 API 响应还有 30–60 秒的 CDN 缓存和 stale-while-revalidate 窗口，可能短暂返回旧数据；其他已打开的浏览器页面需要刷新才能看到新内容。

## 删除规则

删除需要输入完整标题。删除电视节目会同时删除它的季、集、观看记录和评分；删除季会同时删除该季的集。数据库在同一个事务里收集全部后代的 `media_items` 一起删除，不会只删掉外键关系而留下孤立的媒体行。类型、语言、地区和人物词条本身保留，以免影响其他作品。当前的编辑表单不修改音乐、书籍和其他人物职务。
