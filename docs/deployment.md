# 部署与回滚

应用通过 Vercel Git 集成部署，拉取请求用于预览，`main` 用于生产。以下是应配置和执行的流程；仓库文件本身不能证明平台上的分支保护或发布门槛已启用。

## 平台设置

1. GitHub 保护 `main`，要求通过拉取请求合并，并要求 `Application quality checks` 工作流中的 `Lint, types, build, unit, browser & database tests` 检查成功。
2. 按项目权限条件关闭绕过必要检查的能力。
3. Vercel 生产发布应等待必要检查通过；若当前账户不支持该门槛，可保留自动预览，再手动提升已验证的部署。
4. Development、Preview、Production 分别配置环境变量。网站运行不需要 Supabase 运维密钥；预览和测试不得使用生产 service-role 密钥执行写入测试。

## 应用发布

1. 创建拉取请求，等待质量检查和 Vercel 预览构建成功。
2. 执行 `DEPLOYMENT_URL=<预览地址> npm run smoke`，并验证受影响的实际用户流程。
3. 必要检查通过后合并，确认生产部署对应合并后的提交。
4. 确认正式域名指向该部署，再执行 `DEPLOYMENT_URL=https://www.bingetrack.ing npm run smoke`，检查运行日志。

`Deployment health checks` 工作流会响应成功的 GitHub Deployment，也支持手动输入部署地址。受保护预览需要在执行环境设置 `VERCEL_AUTOMATION_BYPASS_SECRET`；不要把它放入公开变量或日志。

## 数据库发布

当前测试阶段使用 `supabase/scripts/current_schema.sql` 维护可重建的完整结构，稳定后再引入版本化迁移。已有数据库变更需在拉取请求中提供准确的增量 SQL、验证结果及回滚方案。

1. 优先新增兼容的字段、表、索引、函数、权限及 RLS，让旧版和新版应用都能运行。
2. 在新本地 Supabase 上加载快照和测试数据，运行数据库测试。
3. 应用依赖新结构时，先实施并验证数据库变更，再发布应用。
4. 检查正式站点及相关查询，后续版本再移除旧代码不再使用的结构。
5. 将已验证的最终结构同步到快照。

完整快照不能直接应用到已有数据库。破坏性变更前备份受影响数据，回滚方案应说明使用应用回滚、修复 SQL 或备份恢复。`supabase/archive/` 为历史增量 SQL，仅供追溯，不在新环境重复执行。

## 应用回滚

1. 数据库仍兼容时，将正式域名恢复到已知正常的 Vercel 部署。
2. 重新运行正式站点检查并查看运行日志。
3. 涉及数据库时依照已审查的恢复方案处理，避免直接反向执行结构变更。
4. 记录故障提交、部署地址、表现和恢复操作。

## 环境配置

变量模板在根目录 `.env.example`，真实本机配置统一放入已忽略的 `.env.local`。已有文件应保留其中的本地运维变量，避免直接用模板或平台拉取结果覆盖。独立脚本需要时可使用：

```sh
node --env-file=.env.local scripts/smoke-deployment.mjs
```

上例仍需通过进程环境提供 `DEPLOYMENT_URL`。Next.js 的环境加载与公开变量规则见 [官方说明](https://nextjs.org/docs/app/guides/environment-variables)。平台变量修改后需要新部署才能生效；本地 `.env.local` 不会同步更改 Vercel 配置。
