# 数据库结构与维护

`migrations/` 是应用 `public` schema 的唯一结构来源，Supabase CLI 按文件名顺序应用。`20260925000000_initial_schema.sql` 是基线，等同于引入迁移机制时生产库的完整结构：类型、表、约束、索引、RLS、视图、函数、事件触发器和权限。迁移不包含 Supabase 托管的 schema，也不包含业务数据。

## 目录

| 路径 | 内容 |
| --- | --- |
| `migrations/` | 版本化结构迁移。新环境、本地和 CI 都从这里重建 |
| `fixtures/e2e_seed.sql` | 固定的浏览器测试数据，只用于本地和 CI，不要导入生产库 |
| `tests/` | pgTAP 测试：公开数据语义、站长权限、事务行为、管理视图与报告 |
| `config.toml` | 本地 Supabase 配置（已关闭注册，Passkey 使用 `localhost`） |
| `seed.sql` | CLI 默认的种子入口，有意留空；测试数据单独加载 |

## 搭建本地数据库

需要 Docker、Supabase CLI 和 `psql`。在项目根目录执行：

```sh
supabase start   # 启动并自动应用 migrations/
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/fixtures/e2e_seed.sql
supabase test db
```

需要从头重建时运行 `supabase db reset`，然后重新载入测试数据。`supabase status` 会显示本地的 URL 和 anon key，填进根目录的 `.env.local`；跑管理端 E2E 还需要本地的 service-role key。

## 权限模型

- 所有 `public` 表都启用 RLS；事件触发器 `rls_auto_enable` 会给新建的表自动启用。
- 匿名和登录用户对影视数据只有 `SELECT` 权限，这是公开网站的预期行为。今后如果要加私密字段或多用户数据，需要先重新设计行列权限，公开缓存也不能照搬。
- 写入权限只授予 `authenticated`，并由 `is_site_owner()` 策略限定为站长。
- 业务函数都是 `security invoker`，不使用 `SECURITY DEFINER`。写入函数开头会检查 `is_site_owner()`，并撤销匿名角色的执行权限。
- 管理视图（`v_manage_media_order`、`v_report_*`）只授权给登录用户读取。

新增函数时，要显式 `revoke execute ... from public, anon`：默认权限目前没有对 `PUBLIC` 撤销函数执行权。

## 查询约定

公开查询集中在 `lib/functions/`，以视图 `v_all_media` 为主，由 mapper 统一转换成前端类型。

- 列表用 `v_media_series_years` 汇总电视节目的发行年份范围，用 `v_media_season_summaries` 汇总季资料、总集数和已看集数。这两个视图是 `security_invoker`，公开角色只能读取。应用只在视图缺失时（`PGRST205`／`42P01`）退回旧查询，权限和网络错误会照常抛出。
- 关键词搜索和「系列」分类通过 `search_media(p_query, p_types, p_series_only, p_credit_roles)` 在数据库内完成跨表匹配，返回 `v_all_media` 的行；状态、类型、年份、排序、分页和精确计数由 PostgREST 在函数结果上叠加。普通目录浏览直接读 `v_all_media`。
- 管理列表按 `v_manage_media_order` 排序：电影和单集按上映日期；电视节目和季按最近一集的播出日期，还没有已播出的集时取最早一集；都是倒序。视图缺失时退回按条目自身的上映日期排序。
- 管理端保存用 `manage_save_media(jsonb)`，删除用 `admin_delete_media`，合并人物用 `manage_merge_people`，报告的批量删除用 `manage_delete_unused`。

## 结构变更流程

1. `supabase migration new <名称>` 新建迁移，写入增量 SQL。已提交的迁移不再修改。
2. `supabase db reset` 验证全部迁移能从零应用，载入测试数据，运行 `supabase test db`。
3. 拉取请求附上验证结果和回滚方案（修复迁移、应用回滚或备份恢复）。
4. 按 [部署说明](../docs/deployment.md) 用 `supabase db push` 发布。站长初始化与恢复见 [单人管理说明](../docs/single-owner-admin.md)。
