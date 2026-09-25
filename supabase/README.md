# 数据库结构与维护

`migrations/` 是应用 `public` schema 的唯一结构来源，由 Supabase CLI 按文件名顺序应用。`20260925000000_initial_schema.sql` 是基线迁移，等同于引入版本化迁移时生产库的完整结构，包含类型、表、约束、索引、RLS、视图、函数、事件触发器和权限。迁移不包含 Supabase 托管 schema 或实际业务数据。

## 文件职责

- `migrations/`：版本化结构迁移；新环境、本地和 CI 都从这里重建。
- `archive/`：引入迁移前已应用的历史增量 SQL，内容已并入基线迁移，仅供追溯，不要执行。
- `fixtures/e2e_seed.sql`：确定性的浏览器测试数据，仅用于本地和 CI。
- `tests/`：公开数据语义与站长权限、事务行为的 pgTAP 测试。
- `config.toml`、`seed.sql`：Supabase CLI 配置与默认种子入口；默认种子有意留空，测试数据单独加载。

## 新建本地数据库

需要 Docker、Supabase CLI 和 `psql`，在项目根目录执行：

```sh
supabase start   # 自动应用 migrations/
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/fixtures/e2e_seed.sql
supabase test db
```

需要从头重建时执行 `supabase db reset`，再重新载入测试数据。不要把测试种子应用到生产数据库。通过 `supabase status` 获取本地公开 URL 和 anon key，填入根目录 `.env.local`；管理 E2E 还需本地 service-role key。

## 查询约定

公开媒体查询集中在 `lib/functions/`，以 `v_all_media` 等视图为主，统一映射前端类型。

列表使用 `v_media_series_years` 汇总电视剧发行年份，使用 `v_media_season_summaries` 汇总季资料、总集数和已看集数。两个普通视图采用 `security_invoker`，公开角色只有读取权限；卡片年份保持数字范围。应用仅在视图缺失（`PGRST205`／`42P01`）时回退到旧查询，权限和网络错误会继续暴露。

关键词搜索和“系列”分类通过 `search_media(p_query, p_types, p_series_only, p_credit_roles)` 在数据库内完成跨表匹配，返回 `v_all_media` 行；状态、类型标签、年份、排序、分页和精确计数由 PostgREST 在函数结果上叠加。普通目录浏览仍直接读取 `v_all_media`。

## 结构变更

1. `supabase migration new <名称>` 新建迁移，写入增量 SQL；已提交的迁移不再修改。
2. `supabase db reset` 验证全部迁移可从零应用，再载入测试数据并运行 `supabase test db`。
3. 拉取请求附带验证结果和回滚方案（修复迁移、应用回滚或备份恢复）。
4. 按[部署说明](../docs/deployment.md)用 `supabase db push` 发布；站长初始化与恢复见[管理说明](../docs/single-owner-admin.md)。
