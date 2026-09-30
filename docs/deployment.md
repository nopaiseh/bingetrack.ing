# 部署与回滚

应用通过 Vercel 的 Git 集成部署：拉取请求生成预览，合并到 `main` 后发布生产。数据库结构由 `supabase/migrations/` 管理，需要手动推送。

## 平台设置

以下设置在 GitHub 和 Vercel 上配置，仓库文件无法证明它们已经启用，需要定期核对：

1. GitHub 保护 `main`：只能通过拉取请求合并，并要求 `Application quality checks` 工作流的 `Lint, types, build, unit, browser & database tests` 检查通过；不允许绕过必要检查。
2. Vercel 生产发布等待必要检查通过。如果账户不支持这个门槛，保留自动预览，手动提升已验证的部署。
3. Development、Preview、Production 分别配置环境变量。网站运行不需要 Supabase 运维密钥；预览和测试环境不得持有生产 service-role 密钥。

## CI

`.github/workflows/test.yml` 在每个拉取请求和 `main` 推送时运行：生产依赖审计 → ESLint → 类型检查 → Vitest → 启动本地 Supabase 并应用迁移 → 载入 `supabase/fixtures/e2e_seed.sql` → 环境检查 → 生产构建 → Playwright → pgTAP。第三方 Action 都固定到提交 SHA。

`.github/workflows/deployment-smoke.yml` 在 Vercel 报告部署成功时，对部署地址运行 `npm run smoke`；也可以手动输入地址触发。受保护的预览需要仓库密钥 `VERCEL_AUTOMATION_BYPASS_SECRET`。工作流总是从默认分支检出检查脚本，不会用被部署提交里的代码处理密钥；`scripts/smoke-deployment.mjs` 只会把这个密钥发给 `bingetrack.ing`、`www.bingetrack.ing` 和 `*.vercel.app` 的 HTTPS 地址，并且每次跳转都重新判断。

## 发布应用

1. 创建拉取请求，等待质量检查和 Vercel 预览构建完成。
2. 运行 `DEPLOYMENT_URL=<预览地址> npm run smoke`，并实际走一遍受影响的用户流程。
3. 合并，确认生产部署对应的是合并后的提交。
4. 确认正式域名指向新部署，运行 `DEPLOYMENT_URL=https://www.bingetrack.ing npm run smoke`，查看 Vercel 运行日志。

每次生产部署后，ISR 页面会在首次访问时重新生成并计入 Vercel 写入用量。相关改动尽量合进一次发布，不要连续多次小部署。改动涉及缓存时，先读 [缓存与 Vercel 写入用量](caching.md)。

## 发布数据库变更

`20260925000000_initial_schema.sql` 是基线迁移，等同于引入迁移机制时生产库的完整结构。在此之前的历史增量 SQL 已并入基线，原文件可以在 Git 历史中查到。

每次结构变更新增一个迁移文件：

1. `supabase migration new <名称>`。优先做兼容的增量变更（新增字段、表、索引、函数、权限、RLS），让新旧两个应用版本都能运行。
2. `supabase db reset` 在本地从全部迁移重建，载入测试数据，再运行 `supabase test db`。
3. 拉取请求里写明验证结果和回滚方案。
4. 应用依赖新结构时，先 `supabase db push` 并验证，再发布应用。
5. 旧代码不再使用的结构，在之后的版本里用新迁移移除。

已提交且已应用的迁移不能修改，修正一律通过新迁移完成。破坏性变更前先备份受影响的数据。

新环境第一次接入迁移机制时，生产库已经有基线结构，只登记不执行：

```sh
supabase link --project-ref <项目 ref>
supabase migration repair --status applied 20260925000000
supabase migration list   # 本地与远端应一致
```

## 回滚

1. 数据库仍兼容时，在 Vercel 把正式域名切回上一个正常的部署。
2. 重新运行正式站点的 smoke 检查，查看运行日志。
3. 涉及数据库时，按拉取请求中已审查的方案处理（修复迁移、应用回滚或备份恢复），不要直接手工反向执行结构变更。
4. 记录出问题的提交、部署地址、现象和恢复操作。

## 环境变量

变量模板在根目录 `.env.example`，本机配置放在被 Git 忽略的 `.env.local`。用 `vercel env pull` 或模板更新时不要直接覆盖已有文件，里面可能有本地运维变量。平台变量修改后需要重新部署才生效，本地 `.env.local` 不会同步到 Vercel。Next.js 的环境变量规则见 [官方说明](https://nextjs.org/docs/app/guides/environment-variables)。
