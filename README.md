# bingetrack.ing

个人影视资料库与观看记录网站。访客匿名浏览电影、电视节目和统计看板；唯一的站长用 Passkey 登录 `/manage` 维护内容。

## 功能

- **统计看板**（`/`）：总览、电影、电视节目三个标签，按发行年份或全部年份查看数量、观看状态、时长、平均评分、地区／语言／类型前五名和评分榜单，另有即将上映倒计时。年份指作品发行年份，不是观看年份。
- **影视目录**（`/movies`、`/shows`）：统计与已看、在看、想看列表；详情页展示简介、封面、评分、日期、语言、地区、类型、演职员和同系列作品，电视节目可进入季和分集。
- **搜索**（`/search`）：关键词加媒体类型、观看状态、类型、地区、语言、年份范围组合筛选，排序、分页，条件保存在 URL 中。
- **内容管理**（`/manage`）：影视、季、集、人物、系列、类型、地区、语言的增删改，数据检查报告与疑似重复人物合并。详见 [内容管理工作台](docs/manage-workspace.md)。
- **认证**：只有一个站长账号，没有公开注册。详见 [单人管理与 Passkey](docs/single-owner-admin.md)。
- **其他**：响应式布局、加载骨架、错误页、站点地图、Open Graph 图片、Sentry 错误监控、Vercel Speed Insights。

数据库没有观看日期字段：电影和单集填了评分即为「看过」，电视节目与季的状态由各集汇总得出。

## 技术栈

Next.js 16 App Router、React 19、TypeScript、UnoCSS、Supabase（PostgreSQL + Auth），部署在 Vercel。需要 **Node.js 24**，用 npm 和已提交的 `package-lock.json`。

> 这个 Next.js 版本和常见资料有差异，改框架相关代码前先查 `node_modules/next/dist/docs/`（见 `AGENTS.md`）。

## 本地启动

```sh
nvm use
npm ci
cp .env.example .env.local   # 已有 .env.local 时不要覆盖
chmod 600 .env.local
```

在 `.env.local` 填入 Supabase URL、anon key 和本地站点地址，然后：

```sh
npm run env:check
npm run dev                  # http://localhost:3000
```

数据库需要具备本仓库的结构。用本地 Supabase 从零搭建的步骤见 [数据库说明](supabase/README.md)。

## 环境变量

模板和逐项说明在 `.env.example`；本机实际值只放在已被 Git 忽略的 `.env.local`。

| 变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 必填。公开页面和站长日常管理都只用这两项 |
| `NEXT_PUBLIC_SITE_URL` | 规范地址、站点地图和 Passkey 使用；生产构建缺失时 `env:check` 会失败 |
| `NEXT_PUBLIC_SENTRY_DSN`、`*SENTRY_TRACES_SAMPLE_RATE`、`SENTRY_AUTH_TOKEN` | 可选。Sentry 只在生产部署上报 |
| `OWNER_EMAIL`、`SUPABASE_SECRET_KEY` | 只供 `npm run owner:login` 这类手动运维工具使用，网站运行不需要 |
| `SUPABASE_SERVICE_ROLE_KEY` | 只供本地管理 E2E 使用，绝不能指向生产库 |

`NEXT_PUBLIC_*` 会打包进浏览器代码，不能放密钥。Next.js 会自动读取 `.env.local`，独立 Node 脚本要用 `node --env-file=.env.local ...` 显式加载（npm 脚本已处理）。Vercel 的 Development / Preview / Production 变量在平台上分别配置，修改后要重新部署才生效。

## 目录结构

```text
app/                    路由、页面、Route Handler、Server Action
  (admin)/              /manage 与 /settings，共用外框和身份检查（组名不进网址）
components/             多个页面共用的界面组件
lib/
  admin/                管理端表单解析、读取、报告和缓存失效
  api/                  搜索与榜单 API 的参数校验和 URL 状态
  auth/                 浏览器端与服务端认证客户端、空闲登出
  functions/            公开数据查询、数据缓存、映射与聚合
  seo/                  详情页元数据与 JSON-LD
  supabase/             不带用户会话的公开服务端客户端
  types/                共享类型
scripts/                环境检查、站长初始化、部署检查、Lighthouse、依赖补丁
supabase/               迁移、测试数据、pgTAP 测试、本地配置
tests/                  Vitest 单元与组件测试
e2e/                    Playwright 浏览器测试
docs/                   运维与设计说明
```

`proxy.ts`、`instrumentation*.ts`、`sentry.*.config.ts` 和各工具配置放在根目录，便于框架发现。

两条约定：

- 公开数据一律经 `lib/functions/` 读取视图并统一映射。新增媒体字段时写新迁移，并同步 `lib/types` 与 mapper。
- 公开查询用匿名客户端（`lib/supabase/public-server.ts`），管理端用带会话的客户端（`lib/auth/server.ts`）。两者不要混用，否则公开缓存可能带上用户会话。

## 命令

| 命令 | 用途 |
| --- | --- |
| `npm run lint` / `npx tsc --noEmit` | ESLint / 类型检查 |
| `npm test` / `npm run test:coverage` | 单元与组件测试 / 覆盖率 |
| `npm run build` / `npm start` | 生产构建 / 本地运行生产版本 |
| `npm run test:e2e` | 浏览器测试，需要本地 Supabase 和测试数据 |
| `supabase test db` | 数据库 pgTAP 测试 |
| `DEPLOYMENT_URL=<地址> npm run smoke` | 检查已部署站点的页面、API 与安全响应头 |
| `npm run perf:lighthouse -- <地址>` | Lighthouse 实验室测量，报告写入被忽略的 `.lighthouse/` |
| `npm run analyze` | 构建产物分析 |
| `npm run owner:login` | 站长初始化或恢复登录，见 [单人管理](docs/single-owner-admin.md) |

首次跑浏览器测试前执行 `npx playwright install chromium`。Playwright 不会自动读取 `.env.local`，管理流程测试请用 `node --env-file=.env.local node_modules/@playwright/test/cli.js test`。管理测试会写数据库，只能对本地 Supabase 运行。

`postinstall` 会执行两个依赖补丁：`patch-unocss.mjs` 让 Next 能以 CommonJS 方式加载 `@unocss/postcss`；`patch-next-code-frame.mjs` 固定 Next 错误代码帧宽度，避免在多字节 UTF-8 字符（如中文）中间截断导致 Rust panic。升级后若补丁目标变了，安装会直接失败；上游修复后删掉对应脚本。

## 相关文档

- [缓存与 Vercel 写入用量](docs/caching.md)：改公开页面或管理端写入逻辑前必读
- [部署与回滚](docs/deployment.md)
- [内容管理工作台](docs/manage-workspace.md)
- [单人管理与 Passkey](docs/single-owner-admin.md)
- [数据库结构与维护](supabase/README.md)
