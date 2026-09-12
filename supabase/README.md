# 数据库结构与维护

`scripts/current_schema.sql` 是应用当前 `public` schema 的完整快照，包含类型、表、约束、索引、RLS、视图、函数、事件触发器和权限。它不包含 Supabase 托管 schema 或实际业务数据，必须在具备 Supabase 基础结构的新数据库上使用。

## 文件职责

- `scripts/current_schema.sql`：新环境与 CI 使用的唯一完整结构入口。
- `archive/media-list-aggregates.sql`：列表聚合视图的历史增量 SQL。
- `archive/manage-catalog.sql`：八类管理工作台的系列权限与原子保存扩展（已应用）。
- `archive/single-owner-admin.sql`：单人管理功能的历史增量 SQL。
- `fixtures/e2e_seed.sql`：确定性的浏览器测试数据，仅用于本地和 CI。
- `tests/`：公开数据语义与站长权限、事务行为的 pgTAP 测试。
- `config.toml`、`seed.sql`：Supabase CLI 配置与默认种子入口；默认种子有意留空，测试数据单独加载。

归档脚本的定义已纳入当前快照，新环境无需重复执行归档。归档不是 Supabase CLI 的版本化迁移目录。

## 新建本地数据库

需要 Docker、Supabase CLI 和 `psql`，在项目根目录执行：

```sh
supabase start
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/scripts/current_schema.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/fixtures/e2e_seed.sql
supabase test db
```

结构加载仅适用于尚未创建应用表的新本地实例。不要把快照或测试种子应用到已有生产数据库。通过 `supabase status` 获取本地公开 URL 和 anon key，填入根目录 `.env.local`；管理 E2E 还需本地 service-role key。

## 查询约定

公开媒体查询集中在 `lib/functions/`，以 `v_all_media` 等视图为主，统一映射前端类型。

列表使用 `v_media_series_years` 汇总电视剧发行年份，使用 `v_media_season_summaries` 汇总季资料、总集数和已看集数。两个普通视图采用 `security_invoker`，公开角色只有读取权限；卡片年份保持数字范围。应用仅在视图缺失（`PGRST205`／`42P01`）时回退到旧查询，权限和网络错误会继续暴露。

聚合视图已经包含在快照中，因此不再单独维护 `media-list-aggregates.md` 上线清单。旧库升级时仍需先准备视图再部署依赖它的应用；若回滚并移除视图，应先回滚应用。搜索分类 ID 预查询的大集合限制属于另一问题。

## 结构变更

当前测试阶段以完整快照维护最终结构。每次已有数据库的变更应提供独立增量 SQL 和回滚方案，先验证权限、受影响查询及本地测试，再按发布流程实施；确认最终状态后同步快照。修改本地文件本身不会改变线上数据库。

稳定后可引入版本化迁移；当前不要把快照当成可反复执行的迁移。完整流程见 [部署说明](../docs/deployment.md)，站长初始化与恢复见 [管理说明](../docs/single-owner-admin.md)。
