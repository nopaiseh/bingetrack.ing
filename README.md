# bingetrack.ing

个人影视资料库与观看记录网站。访客可以浏览电影、电视剧和统计看板，唯一站长通过 Passkey 登录后台维护内容。

## 现有功能

- **统计看板**：总览、电影、电视剧三个标签，按发行年份或全部年份查看数量、观看状态、时长、平均评分，以及地区、语言、类型前五名分布和评分榜单。年份表示作品发行年份，不是实际观看年份。
- **影视目录**：电影与电视剧分别展示统计、已看和想看列表；详情展示简介、封面、评分、日期、语言、地区、类型及演职员，电视剧可继续查看季和分集信息。
- **搜索筛选**：关键词搜索，组合媒体类型、观看状态、类型标签、地区、语言与年份范围，支持排序、分页加载和 URL 保存筛选条件。
- **站长管理**：新增、编辑和删除电影、电视剧、季、集，维护资料、评分和看过／没看过状态；删除剧集或季会一并删除对应后代数据。当前没有观看日期或独立播放进度字段。
- **认证与权限**：Passkey 登录及凭证管理；站长身份由 Supabase Auth、固定站长记录和数据库 RLS 共同校验。访客无需登录，网站没有公开注册入口。
- **基础体验**：响应式布局、加载骨架、错误与空状态、详情页分享元数据、站点地图和 Open Graph 图片；集成 Sentry 与 Vercel Speed Insights。

## 技术栈

Next.js 16 App Router、React 19、TypeScript、UnoCSS、Supabase PostgreSQL / Auth。项目要求 **Node.js 24**，使用 npm 和提交到仓库的 `package-lock.json`。

## 本地启动

```sh
nvm use
npm ci
cp .env.example .env.local
chmod 600 .env.local
```

已有 `.env.local` 时不要覆盖。填写 Supabase URL 和公开 anon key，将站点地址设为本地使用的地址，然后执行：

```sh
npm run env:check
npm run dev
```

访问 `http://localhost:3000`。Supabase 项目需要具备本仓库的数据库结构；新建本地数据库和测试数据的步骤见 [数据库说明](supabase/README.md)。

## 环境配置

根目录只维护两个环境文件：

| 文件 | 用途 |
| --- | --- |
| `.env.example` | 可提交的变量模板，包含中文说明，不含真实密钥 |
| `.env.local` | 本机实际配置，已被 Git 忽略，包含开发和可选运维变量 |

`NEXT_PUBLIC_*` 会进入浏览器构建，不能存放私密令牌。公开页面和站长日常管理仅需要 Supabase URL、anon key；`SUPABASE_SECRET_KEY` 与 `OWNER_EMAIL` 仅供手动初始化／恢复工具使用。`SUPABASE_SERVICE_ROLE_KEY` 供本地管理 E2E 使用，不能指向生产环境运行写入测试。

Next.js 自动加载 `.env.local`；独立 Node 脚本需显式加载。环境检查和站长工具已有 npm 入口：

```sh
npm run env:check
npm run owner:login -- --create  # 首次初始化；会创建账号并指定站长
npm run owner:login            # 为已有站长生成恢复链接
```

执行站长工具前确认项目地址、站点地址及邮箱，完整流程见 [单人管理与 Passkey](docs/single-owner-admin.md)。一次性链接写入 `.local-admin/login-link.txt`，使用后删除。

Sentry 的 DSN、组织及项目目前配置在源码中；`SENTRY_AUTH_TOKEN` 仅用于源码映射上传等运维操作。环境标签由构建环境计算，采样率见模板；浏览器、Node 和 Edge 仅在生产部署上报事件，本地、CI 和预览环境关闭上报。Vercel 的 Development、Preview 和 Production 变量在平台分别配置，本地文件不会替代平台配置。

## 目录结构

```text
app/                    页面、路由、Server Actions 和页面专用组件
components/             多页面共享的界面组件
lib/
  admin/                后台表单与读取逻辑
  api/                  API 参数和搜索状态转换
  auth/                 浏览器及服务端认证客户端
  functions/            公开媒体查询、缓存、映射和聚合逻辑
  seo/                  媒体元数据
  supabase/             无用户会话的公开服务端数据库客户端
  types/                共享类型
scripts/                环境检查、站长初始化、部署检查和性能测量
supabase/
  scripts/              当前数据库结构快照
  archive/              已实施的历史增量 SQL，保留供追溯
  fixtures/             本地与 CI 的固定测试数据
  tests/                数据库 pgTAP 测试
  config.toml           本地 Supabase 配置
  seed.sql              CLI 默认种子入口（有意留空）
tests/                  单元与组件测试
e2e/                    浏览器端到端测试
docs/                   部署及管理操作说明
.github/                CI 工作流与依赖更新配置
```

Next.js 的 `proxy.ts`、`instrumentation*.ts`、Sentry 初始化文件和各工具配置保留在根目录，方便框架发现。`.next/`、`coverage/`、`test-results/`、`.lighthouse/` 等为忽略提交的生成文件。

公开数据主要通过 `lib/functions/` 读取视图并统一映射；新增媒体字段时同步数据库快照、共享类型和映射。认证客户端与匿名公开客户端各自保留，避免公开缓存携带用户会话。

## 检查与测试

| 命令 | 用途 |
| --- | --- |
| `npm run lint` | ESLint 检查 |
| `npx tsc --noEmit` | TypeScript 检查 |
| `npm test` | 单元与组件测试 |
| `npm run test:coverage` | 生成覆盖率报告 |
| `npm run build` / `npm start` | 构建并运行生产模式 |
| `npm run test:e2e` | 手机、平板、桌面浏览及管理流程测试 |
| `npm run test:all` | 单元测试后执行浏览器测试 |
| `supabase test db` | 本地数据库 pgTAP 测试 |
| `DEPLOYMENT_URL=https://www.bingetrack.ing npm run smoke` | 已部署站点的路由、API 和响应头检查 |
| `npm run perf:lighthouse -- http://localhost:3000` | Lighthouse 实验室性能报告 |
| `npm run analyze` | Next.js 构建包分析 |

E2E 依赖本地 Supabase 和固定种子数据；管理测试会写数据库。首次运行浏览器测试前安装 Chromium：`npx playwright install chromium`。Playwright 测试进程不会自动读取 `.env.local`；需要本地管理测试时，使用 `node --env-file=.env.local node_modules/@playwright/test/cli.js test`，或预先在进程环境设置本地数据库变量。CI 使用 Node 24，重建本地数据库后执行构建、浏览器及数据库测试。Lighthouse 结果不等同于真实用户性能数据。

部署、检查和回滚见 [部署说明](docs/deployment.md)。
