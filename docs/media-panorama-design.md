# 媒体全景：音乐／图书纳入 — 设计调研

> 临时分支 `cursor/media-panorama-design-bf63` · 仅调研与原型 · **不开 PR** · 不改 `main` · 不碰生产库／环境变量  
> 后端扩展 `release_year_stats` **另开 PR**

原型：`/design/media-panorama/{a,b,c}`  
截图（含想听／想读）：`panorama_want_{a|b|c}_{1440|390}.png`

---

## 1. 现网全景怎么取数

| 层 | 位置 | 作用 |
| --- | --- | --- |
| 页面 | `app/page.tsx` | `getCachedReleaseYearStats()` → `summary` |
| 看板 | `HomeDashboard` + `deriveDashboardStats` | 按年取行 |
| 标题区 | `DashboardIntro` | 电影总计／电视总计／完成进度 |
| 总览 | `OverviewBoards` | 电影已看／想看；电视已看／在看／想看 |
| 数据源 | `public.release_year_stats` | 现网 **仅** movie + tv_show |

完成进度：`total_watched_runtime / total_runtime`（**仅影视片长**；音书不并入——已定）。

---

## 2. 想听／想读：现有数据里有没有？

**有。** 底层 tracking／视图已支持，不是新造状态。

### 专辑（想听）

| 项 | 结论 |
| --- | --- |
| DB 值 | `tracking_status = want_to_watch`（曲目级；专辑状态由曲目汇总） |
| `v_all_media` | 专辑 `status` 可为 `watched`（已听／听过）、`watching`（在听）、`want_to_watch`（想听） |
| 展示文案 | `lib/listen-status.ts`：`want_to_watch` →「想听」；`MEDIA_TYPE_DEFINITIONS.album.trackingLabels.want` =「想听」 |
| 全量计数 | `get_media_stats('album')` 的 `want` 列即可拿到想听数 |

**注意：** 专辑在现网还有第三态 **「在听」**（`watching`：部分曲目已听、未听完）。因此：

- `总数` ≠ 一定等于 `已听 + 想听`
- 本原型 mock：总数 28＝已听 14＋想听 8＋（未展示的在听 6）
- 若年统计只出「已听／想听」而不出「在听」，报告／UI 应接受差额，或后端把「在听」并入某一侧（需产品拍板）

### 图书（想读）

| 项 | 结论 |
| --- | --- |
| DB 值 | `tracking.status = want_to_watch`（图书条目级） |
| 合法状态 | `watched`（读过／已读）、`in_progress`（在读）、`want_to_watch`（想读） |
| 展示文案 | `READ_STATUS_DISPLAY.want_to_watch` =「想读」；`trackingLabels.want` =「想读」 |
| 全量计数 | `get_media_stats('book')` → `want`；`getBookStats().wantToWatch` |
| 目录页 | `BooksCatalog` 已有「想读」筛选与分区 |

图书一般：`总数 = 已读 + 在读 + 想读`（无「在听」类第四态）。

---

## 3. 已定后端字段名（`release_year_stats` 另 PR）

| 媒体 | 列名 | 展示 |
| --- | --- | --- |
| 专辑 | `total_albums` | 总数 |
| 专辑 | `listened_albums` | 已听 |
| 专辑 | **`want_albums`** | 想听（后端已确认字段名） |
| 图书 | `total_books` | 总数 |
| 图书 | `read_books` | 已读 |
| 图书 | `reading_books` | 在读 |
| 图书 | **`want_books`** | 想读（后端已确认字段名） |

年份：专辑发行日／书出版日；`All Time` 汇总。完成进度仍只算影视片长。

可选：年统计是否另出专辑「在听」列——现网有该态，未在上表；产品另定。

---

## 4. 原型字段形状

原型 `MOCK_SUMMARY` **已按上表字段名**（含 `want_albums` / `want_books`）驱动三方案。

| 媒体 | 展示 |
| --- | --- |
| 专辑 | 总数 · 已听 · 想听 |
| 图书 | 总数 · 已读 · 在读 · 想读 |
| 标题完成进度 | 仅影视 |

空态：图书全 0 +「暂无收录」。

---

## 5. 三方案要点

| 方案 | 布局 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A 四格并列** | 2×2 等权看板 | 四类对等；音书状态一目了然 | 图书 0 占大卡；页更高 |
| **B 主次两层** | 影视大卡 +「声音与文字」次层 | 改动小、延续强 | 音书偏次 |
| **C 密度行（推荐）** | 每类一行，状态格随列数伸缩 | 想听／想读加列不挤；空态轻；手机好扫 | 与现网大卡略有落差 |

**推荐仍为 C。** 图书三态、专辑两态（外加可选在听）用行式最省事；完成进度与音书解耦也清楚。

---

## 6. 分工（本调研）

| 项 | 谁 |
| --- | --- |
| `release_year_stats` 加音书列（含想听／想读） | 后端另 PR |
| 是否年统计也出「在听」 | 产品／后端拍板 |
| 标题区／总览按新列渲染 | 前端后续 |
| 本分支 | 原型 + 报告 + 截图 · **不开 PR** |
