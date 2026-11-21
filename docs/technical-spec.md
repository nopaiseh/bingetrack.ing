# 技术规范

协作与变更须遵守本文。专题细节请看链接，勿在此重复展开：

- [缓存与 Vercel 写入用量](caching.md)
- [部署与回滚](deployment.md)
- [内容管理工作台](manage-workspace.md)
- [单人管理与 Passkey](single-owner-admin.md)
- [数据库结构与维护](../supabase/README.md)

技术栈与命令见根目录 [README](../README.md)：Next.js 16 App Router、React 19、TypeScript、UnoCSS、Supabase、Vercel；Node.js 24。改框架相关代码前先查 `node_modules/next/dist/docs/`（见 `AGENTS.md`）。

## 1. 目录结构

| 路径 | 放什么 |
| --- | --- |
| `app/` | App Router：公开页（如 `movies/`、`shows/`、`albums/`、`books/`、`search/`）、`app/api` Route Handler、`app/auth`、路由组 `app/(admin)/`（`/manage`、`/settings`，组名不进 URL） |
| `components/` | 多页共用 UI；按域分子目录（如 `dashboard/`、`search/`） |
| `lib/` | **生产**代码：查询、映射、认证、管理逻辑、共享类型与工具 |
| `lib/functions/` | 公开数据读取、`unstable_cache`、mapper（经视图统一映射） |
| `lib/admin/` | 管理端解析、列表、报告、保存与缓存失效 |
| `lib/api/` | API／搜索参数校验与 URL 状态（不含直接 DB 访问） |
| `lib/auth/` | 浏览器与服务端认证客户端、空闲登出 |
| `lib/supabase/` | 无用户会话的公开服务端客户端（`public-server.ts`） |
| `lib/types/` | 共享类型；新增媒体字段时与 mapper、迁移同步 |
| `lib/media-types.ts` | 媒体类型单一配置源（见第 3 节） |
| `supabase/migrations/` | `public` schema 的唯一结构来源 |
| `supabase/tests/` | pgTAP |
| `supabase/fixtures/` | 本地／CI 浏览器夹具，禁止导入生产 |
| `tests/` | Vitest 单元与组件测试（`*.test.ts(x)`，入口见 `vitest.config.mts`） |
| `tests/helpers/` | **仅测试用**辅助代码（例：`song-release-year.ts`）；**不要**放进 `lib/` |
| `e2e/` | Playwright（`*.spec.ts`） |
| `scripts/` | 环境检查、站长工具、smoke、依赖补丁等 |
| `docs/` | 运维与设计说明 |
| 根目录 | `proxy.ts`、`instrumentation*.ts`、Sentry／Uno／ESLint／Prettier 等配置 |

两条约定（与 README 一致）：

1. 公开数据一律经 `lib/functions/` 读取视图并统一映射。
2. 公开查询用匿名客户端；管理端用带会话的客户端。二者勿混用，以免公开缓存带上用户会话。

`proxy.ts` 只为 `/manage`、`/settings`、`/auth` 刷新会话并加私有缓存头；公开详情页的 UUID 校验与 ISR 关系见 [caching.md](caching.md)。旧 `/admin` 路由已删除，访问应 404。

## 2. 命名

按仓库现状归纳，新代码对齐同一套：

| 对象 | 约定 | 示例 |
| --- | --- | --- |
| 源／模块文件 | kebab-case | `media-types.ts`、`revalidate-media.ts`、`format-runtime.ts` |
| React 组件文件 | PascalCase | `MediaCardBody.tsx`、`ContinueWatchingRail.tsx` |
| 同域非组件辅助 | 可与组件并列的 kebab 或同目录工具 | `dashboard-links.ts`、`search-model.ts` |
| Vitest | 主题 + `.test.ts`／`.test.tsx` | `media-repo.test.ts`、`home-dashboard.test.tsx` |
| Playwright | 主题 + `.spec.ts` | `core-journeys.spec.ts`、`admin-access.spec.ts` |
| 迁移 | `YYYYMMDDHHMMSS_snake_name.sql`，时间戳递增 | `20261121060000_v_all_media_music_coalesce_dates.sql` |
| pgTAP | snake_case + `.test.sql` | `permission_guard.test.sql`、`music_atomic_save.test.sql` |
| TS 函数／变量 | camelCase | `searchMediaServer`、`requireOwner`、`parseMediaSearchParams` |
| TS 类型／组件 | PascalCase | `PublicMediaType`、`MediaInformation` |
| 导出常量 | UPPER_SNAKE 或配置对象 | `CATALOG_DB_TYPES`、`SEARCH_DB_TYPES`、`MEDIA_TYPE_DEFINITIONS` |
| 表／列／枚举值 | snake_case | `media_items`、`tv_show`、`want_to_watch`、`in_progress` |
| 视图 | 多为 `v_` 前缀 | `v_all_media`、`v_manage_media_order`、`v_media_season_summaries`、`v_report_*`；例外如 `release_year_stats` |
| SQL 函数 | snake_case；参数常用 `p_` | `is_site_owner()`、`manage_save_media(p_data)`、`search_media(...)`、`get_media_stats(p_media_type)` |
| 管理 RPC | 现行写入 `manage_*`；`admin_*` 为兼容旧调用保留 | 见 [manage-workspace.md](manage-workspace.md) |
| Server Action 文件 | `actions.ts` 或 `*-actions.ts` | `list-actions.ts`、`report-actions.ts`、`reference-actions.ts` |
| RLS 策略名 | 英文短句 | `"Allow SELECT from website"`、`"Owner insert"` |

路径别名：`@/` → 仓库根。测试专用模块：`@/tests/helpers/...`。

## 3. 组件与接口约定

### 媒体类型

单一配置源：[`lib/media-types.ts`](../lib/media-types.ts)。

| 导出 | 用途 |
| --- | --- |
| `MEDIA_TYPE_DEFINITIONS` | 路由段、中文标签、封面比例、元数据字段、追踪文案、schema.org、enabled／admin 开关 |
| `CATALOG_DB_TYPES` | 有公开顶层路由且启用的 DB 类型（当前：`movie`、`tv_show`、`album`、`book`） |
| `SEARCH_DB_TYPES` | 公开搜索 `type=` 白名单（目录类型 + `music`） |
| `PUBLIC_MEDIA_TYPES`／`ENABLED_PUBLIC_CATALOG_PATHS` | 公开路由段与路径 |
| `ADMIN_BULK_DB_TYPES`／`mediaTypes` | 管理端批量与表单标签 |
| `isCatalogDbMediaType`／`isSearchDbMediaType`／`publicRouteToDbType` 等 | 校验与路由↔DB 转换 |

**禁止**在路由、API、组件、SQL 调用处另写一套类型字面量列表。新增类型：先改本文件，再补迁移、mapper 与 `lib/types`。

### API 与 Supabase 分层

典型公开搜索路径：

1. **Route Handler**（如 `app/api/media/route.ts`）：解析 URL、校验、设 `Cache-Control`、映射 400／503；不堆业务 SQL。
2. **参数层**（`lib/api/`）：`parseMediaSearchParams` 等；媒体类型集合取自 `SEARCH_DB_TYPES`。
3. **数据层**（`lib/functions/`）：经 `getSupabasePublicServer()` 读 `v_all_media`／`search_media` 等，mapper 转前端类型。
4. **管理写入**：Server Action → `requireOwner()` → RPC（如 `manage_save_media`）→ 按 [caching.md](caching.md) 失效。

页面 Server Component 同样只通过 `lib/functions/`（或管理侧 `lib/admin/`）取数，不在页面文件里散落 Supabase 查询。

### 权限与安全

- **站长**：每个管理页与写入 Action 调用 `requireOwner()`（Auth + 空闲 Cookie + `is_site_owner()`）。细节：[single-owner-admin.md](single-owner-admin.md)。
- **RLS**：所有 `public` 表必须启用；事件触发器 `rls_auto_enable` 覆盖新建表。匿名／登录对影视数据默认可 `SELECT`；写入仅 `authenticated`，策略使用 `(select public.is_site_owner())`。
- **调用者权限**：业务函数为 `security invoker`（不用 `SECURITY DEFINER`），并固定 `search_path`；视图声明 `with (security_invoker = true)`。
- **授权**：新建函数显式 `grant execute`——公开给 `anon, authenticated`，管理只给 `authenticated`——并 `revoke` 自 `public`／不需要的角色。`supabase/tests/permission_guard.test.sql` 会动态枚举对象查漏。

客户端不得嵌入运维密钥，不得设认证绕过开关。管理区不渲染公开站顶栏／页脚／底部标签（见 [manage-workspace.md](manage-workspace.md)）。

## 4. 数据库迁移规则

**合并进 `main` 会把迁移应用到生产库，因此批准合并等于批准上线。** 含迁移的 PR 按生产变更标准审查，不能当普通文案或纯前端改动。

1. **新建**：`supabase migration new <名称>`；文件名时间戳须严格递增，避免与并行 PR 乱序（必要时在合并前改名）。
2. **只增不改**：已合并／已应用的迁移文件不得再改内容；修正一律新增迁移。
3. **优先兼容增量**：加列、表、索引、函数、权限、RLS；尽量让新旧应用版本短暂共存。发布顺序与回滚见 [deployment.md](deployment.md)、[supabase/README.md](../supabase/README.md)。
4. **替换视图／函数**：保持列名、类型、顺序与授权语义不变（若追加列须写明）；注明 `security_invoker`／权限是否变化及对公开／管理端的影响。仓库内常见写法：「列与 security_invoker 保持不变」「无新增数据暴露」。
5. **破坏性改动**（`DROP`、改列类型、删／改业务数据、收紧约束可能导致失败）：在 PR 说明里**单独标出**，附验证步骤与回滚方案；破坏前先备份受影响数据。
6. **依赖生产数据的约束**（如唯一约束）：迁移内先查重／预检，有违规则 `RAISE` 并给出样例，**禁止静默跳过**（参见 `20261120140000_music_atomic_save_and_constraints.sql` 对曲序重复的预检）。
7. **本地验证**：`supabase db reset` → 载入 `supabase/fixtures/` → `supabase test db`；PR 写明结果与回滚方案。

基线：`20260925000000_initial_schema.sql`。查询视图约定（`v_all_media`、`v_manage_media_order` 等）见 [supabase/README.md](../supabase/README.md)。

## 5. 测试要求

| 改动范围 | 要求 |
| --- | --- |
| 业务逻辑（`lib/`、Route Handler、Server Action、共享组件行为） | 补／改 Vitest：`npm test` 或 `npm run test:coverage` |
| 数据库结构、RPC、视图、RLS、权限 | 补／改 pgTAP：`supabase test db` |
| 关键用户流程 | 视情况补 `e2e/`；管理 E2E **仅**对本地 Supabase，禁止打生产库 |

pgTAP：优先使用 `select plan(N)`，且 **N 与断言条数一致**；只有沿用既有风格时才用 `no_plan()`（如部分 `admin_schema`／`manage_reports`）。改断言数时同步改 `plan`。

CI：`.github/workflows/test.yml`（工作流名 `Application quality checks`，任务名含 Lint／types／build／unit／browser／database）在每个 PR 与 `main` 推送时运行大致顺序：生产依赖审计 → Prettier → ESLint → `tsc` → Vitest 覆盖率 → 本地 Supabase 并应用迁移 → 载入 fixtures → `env:check` → 生产构建 → Playwright → pgTAP。

**CI 全绿才能请求审查。** 覆盖率门槛见 `vitest.config.mts`（lines／statements／functions／branches）。改公开页或缓存逻辑前先读 [caching.md](caching.md)；部署与 smoke 见 [deployment.md](deployment.md)。仅测试用的 mock、样例构造与口径辅助放 `tests/helpers/`，保持 `lib/` 可被生产构建引用的代码干净。

## 6. 流程与安全

1. **分支**：不直接推 `main`；一律经拉取请求。`main` 受保护，必要状态检查为上述质量工作流（平台核对见 [deployment.md](deployment.md)）。
2. **架构审查**：审查结论只能是 **通过**／**需修改**／**不建议合并**。
3. **合并**：架构审查为「通过」后，由作者请**阁主本人**批准再合并；他人不得代合。
4. **密钥**：不得出现在代码、提交、PR 正文、聊天或日志中；不得放进任何 `NEXT_PUBLIC_*` 变量。模板在 `.env.example`，本机放被 Git 忽略的 `.env.local`（权限建议 `600`）。
5. **预览环境**：Preview／测试环境**不得**持有生产 `SUPABASE_SERVICE_ROLE_KEY`（无 service role key）。公开页与 Passkey 会话只用 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
6. **发布**：应用经 Vercel 在合并 `main` 后发布生产；数据库随迁移合并上线（见第 4 节）。事后 smoke、域名核对与回滚步骤见 [deployment.md](deployment.md)。

站长 Passkey、空闲登出、Agent／开发登录与本地 `npm run owner:login` 见 [single-owner-admin.md](single-owner-admin.md)。管理工作台路由与表单行为见 [manage-workspace.md](manage-workspace.md)。
