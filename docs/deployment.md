# 部署与回滚

应用通过 Vercel 的 Git 集成部署：拉取请求生成预览，合并到 `main` 后发布生产。数据库结构由 `supabase/migrations/` 管理；**合并进 `main` 时，Supabase GitHub 集成会自动把尚未应用的迁移推到生产库**。不要在 Supabase 控制台、MCP 或其他渠道手工改生产结构，也不要在本地对生产项目执行结构变更。

## 预览构建是否跳过

`vercel.json` 的 `ignoreCommand` 指向 `scripts/vercel-ignore-build.sh`，用于减少不必要的 Preview 构建费用：生产（`main`）永远构建；Preview 默认跳过，仅当**提交标题（首行）**含 `[preview]`，或相对 `main` 的改动包含前端界面文件（`components/`、`hooks/`、`public/`、样式配置、`app/` 下的页面／布局／组件等）时才构建；`dependabot/`／`renovate/` 分支一律跳过（除非标题含 `[preview]`）。需要强制出预览时，在提交标题里加上 `[preview]` 即可（审查人也可请作者补一个带该标记的提交）。只检查首行，避免正文文档提到该标记时误触发。脚本每一步会在 Vercel 构建日志里打印判断理由。

## 平台设置

以下设置在 GitHub 和 Vercel 上配置，仓库文件无法证明它们已经启用，需要定期核对：

1. GitHub 保护 `main`：只能通过拉取请求合并，并要求 `Application quality checks` 的 `Lint, types, build, unit, browser & database tests`，以及 `Migration hygiene` 的 `Migration versions after main` 与 `Schema snapshot matches migrations` 通过；不允许绕过必要检查。
2. Vercel 生产发布等待必要检查通过。如果账户不支持这个门槛，保留自动预览，手动提升已验证的部署。
3. Development、Preview、Production 分别配置环境变量。公开页面和 `/auth/confirm` 只用 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。服务端生成一次性登录链接时读取 `SUPABASE_SECRET_KEY`，未设置则使用 `SUPABASE_SERVICE_ROLE_KEY`。生产环境配置的是 `SUPABASE_SERVICE_ROLE_KEY`，不设置 `SUPABASE_SECRET_KEY` 或 `AGENT_LOGIN_TOKEN`。预览和测试环境不得持有生产的 `SUPABASE_SERVICE_ROLE_KEY`。

## CI

`.github/workflows/test.yml` 在每个拉取请求和 `main` 推送时运行：生产依赖审计 → ESLint → 类型检查 → Vitest → 启动本地 Supabase 并应用迁移 → 载入 `supabase/fixtures/e2e_seed.sql` → 环境检查 → 生产构建 → 载入 `supabase/fixtures/e2e_album_seed.sql`（构建后载入以保留 `/albums` 空状态）→ Playwright → pgTAP。第三方 Action 都固定到提交 SHA。

`.github/workflows/migration-hygiene.yml` 额外检查：

1. **Migration versions after main**：PR 里新增的迁移文件，版本／时间戳必须严格大于 base 分支（通常是 `main`）上已有的最大迁移版本，避免并行 PR 乱序。
2. **Schema snapshot matches migrations**：本地从迁移重建数据库后，导出的 `public` schema（含 `ensure_rls` 事件触发器与 `ALTER DEFAULT PRIVILEGES`）必须与 `supabase/schema_snapshot.sql` 一致。结构变更后用 `npm run db:schema:snapshot` 重新生成并一并提交。

`.github/workflows/deployment-smoke.yml` 在 Vercel 报告部署成功时，对部署地址运行 `npm run smoke`；也可以手动输入地址触发。受保护的预览需要仓库密钥 `VERCEL_AUTOMATION_BYPASS_SECRET`。工作流总是从默认分支检出检查脚本，不会用被部署提交里的代码处理密钥；`scripts/smoke-deployment.mjs` 只会把这个密钥发给 `bingetrack.ing`、`www.bingetrack.ing` 和 `*.vercel.app` 的 HTTPS 地址，并且每次跳转都重新判断。

`.github/workflows/database-backup.yml` 每天导出一次生产数据库，加密后保存为构建产物，见下文「数据库备份」。

## 发布应用

1. 创建拉取请求，等待质量检查与迁移卫生检查完成。若改动含前端界面或提交标题带 `[preview]`，再等 Vercel 预览构建；纯后端／文档／CI 类改动通常会跳过预览（见上文「预览构建是否跳过」）。
2. 有预览时运行 `DEPLOYMENT_URL=<预览地址> npm run smoke`，并实际走一遍受影响的用户流程；无预览则依赖 CI 与本地验证。
3. 合并，确认生产部署对应的是合并后的提交；若 PR 含迁移，确认 Supabase 集成已把迁移应用到生产。
4. 确认正式域名指向新部署，运行 `DEPLOYMENT_URL=https://www.bingetrack.ing npm run smoke`，查看 Vercel 运行日志。

每次生产部署后，ISR 页面会在首次访问时重新生成并计入 Vercel 写入用量。相关改动尽量合进一次发布，不要连续多次小部署。改动涉及缓存时，先读 [缓存与 Vercel 写入用量](caching.md)。

## 发布数据库变更

`20260925000000_initial_schema.sql` 是基线迁移，等同于引入迁移机制时生产库的完整结构。在此之前的历史增量 SQL 已并入基线，原文件可以在 Git 历史中查到。

每次结构变更新增一个迁移文件：

1. `supabase migration new <名称>`。优先做兼容的增量变更（新增字段、表、索引、函数、权限、RLS），让新旧两个应用版本都能运行。文件名时间戳须严格大于 `main` 上已有的最大版本。
2. `supabase db reset` 在本地从全部迁移重建，载入测试数据，再运行 `supabase test db`。
3. `npm run db:schema:snapshot` 更新 `supabase/schema_snapshot.sql`，并与迁移一并提交。
4. 拉取请求里写明验证结果和回滚方案。合并进 `main` 后由 Supabase GitHub 集成自动应用到生产；应用依赖新结构时，等迁移完成后再发布或确认应用版本与结构兼容。
5. 旧代码不再使用的结构，在之后的版本里用新迁移移除。

已提交且已应用的迁移不能修改，修正一律通过新迁移完成。破坏性变更前先备份受影响的数据。

**禁止**：在 Supabase Dashboard 里改生产 schema、用 MCP／SQL 编辑器直接改生产结构、或对已 link 的生产项目在本地执行结构推送。生产结构变更的唯一入口是合并到 `main` 的迁移文件。

新环境第一次接入迁移机制时，生产库已经有基线结构，只登记不执行：

```sh
supabase link --project-ref <项目 ref>
supabase migration repair --status applied 20260925000000
supabase migration list   # 本地与远端应一致
```

## 数据库备份

Supabase 免费计划没有自动备份。`.github/workflows/database-backup.yml` 每天 02:00（新加坡时间）用 `supabase db dump` 导出角色、结构和 `public` 的数据，也可以在 Actions 页面手动触发。`auth` 等 Supabase 托管的 schema 不在导出范围内，恢复后需要重新创建站长账户。

需要两个仓库密钥：

- `SUPABASE_DB_URL`：生产库的 Session pooler 连接串（Supabase 控制台 → Connect）。GitHub 的运行器没有 IPv6，不能用直连地址；密码里的特殊字符要做百分号编码。
- `BACKUP_PASSPHRASE`：加密口令。另存一份在密码管理器里，丢失后所有备份都无法解密。

导出文件打包后用 GPG（AES-256）对称加密，上传为该次运行的构建产物 `database-backup-<运行编号>`，保留 30 天。仓库是公开的，构建产物可以被任何登录 GitHub 的人下载，所以不能去掉加密这一步，也不要让导出内容出现在日志里。

恢复到一个空的 Supabase 项目：

```sh
gpg --decrypt database-backup.tar.gz.gpg | tar -xz
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "<目标库连接串>"
supabase migration repair --status applied <已包含在备份里的迁移版本>
```

工作流失败时 GitHub 会发邮件通知。偶尔下载一份解密检查，确认备份确实可用。

## 回滚

1. 数据库仍兼容时，在 Vercel 把正式域名切回上一个正常的部署。
2. 重新运行正式站点的 smoke 检查，查看运行日志。
3. 涉及数据库时，按拉取请求中已审查的方案处理（修复迁移、应用回滚或备份恢复），不要直接手工反向执行结构变更。
4. 记录出问题的提交、部署地址、现象和恢复操作。

仅文档／CI／快照类改动回滚：还原该 PR 即可，不会改生产库。

## 环境变量

变量模板在根目录 `.env.example`，本机配置放在被 Git 忽略的 `.env.local`。用 `vercel env pull` 或模板更新时不要直接覆盖已有文件，里面可能有本地运维变量。平台变量修改后需要重新部署才生效，本地 `.env.local` 不会同步到 Vercel。Next.js 的环境变量规则见 [官方说明](https://nextjs.org/docs/app/guides/environment-variables)。
