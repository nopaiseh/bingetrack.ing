# 媒体全景：音乐／图书纳入 — 设计调研

> 临时分支 `cursor/media-panorama-design-bf63` · 仅调研与原型 · **不开 PR** · 不改 `main` · 不碰生产库／环境变量  
> 后端字段以 **[PR #229](https://github.com/nopaiseh/bingetrack.ing/pull/229)** 为准

原型：`/design/media-panorama/{a,b,c}`  
截图：`panorama_want_{a|b|c}_{1440|390}.png`（已含想听／想读；字段名与 #229 一致，未重截）

---

## 1. 现网全景怎么取数

| 层 | 位置 | 作用 |
| --- | --- | --- |
| 页面 | `app/page.tsx` | `getCachedReleaseYearStats()` → `summary` |
| 看板 | `HomeDashboard` + `deriveDashboardStats` | 按年取行 |
| 标题区 | `DashboardIntro` | 电影总计／电视总计／完成进度 |
| 总览 | `OverviewBoards` | 电影已看／想看；电视已看／在看／想看 |
| 数据源 | `public.release_year_stats` | 现网仅 movie + tv_show；**#229 末尾追加专辑／图书七列** |

完成进度：`total_watched_runtime / total_runtime`（**仅影视**；#229 不改时长列）。

---

## 2. 想听／想读：现有数据里有没有？

**有**（写入侧／目录／`get_media_stats` 已用）。年统计侧由 #229 落列。

| 展示 | DB | #229 列 |
| --- | --- | --- |
| 已听 | 专辑 `tracking.status = watched` | `listened_albums` |
| 想听 | 专辑 `tracking.status = want_to_watch` | `want_albums` |
| 已读 | 图书 `watched` | `read_books` |
| 在读 | 图书 `in_progress` | `reading_books` |
| 想读 | 图书 `want_to_watch` | `want_books` |

口径要点（#229）：

- **无 tracking 不计想听／想读**（计入 `total_*`，但不进 `want_*`）
- 单曲（`music`）不计
- 须有 `release_date`；年份按发行／出版日；`All Time` 与电影一致
- #229 **不**把曲目汇总的「在听」写进年统计；全景这七列没有「在听」

因此：`total_albums` 可以大于 `listened_albums + want_albums`（差额＝无 tracking 等未完成）。

---

## 3. PR #229 七列（视图末尾顺序）

```
total_albums
listened_albums
total_books
read_books
reading_books
want_albums
want_books
```

| 列名 | 含义 |
| --- | --- |
| `total_albums` | 专辑总数 |
| `listened_albums` | 已听 |
| `total_books` | 图书总数 |
| `read_books` | 已读 |
| `reading_books` | 在读 |
| `want_albums` | 想听 |
| `want_books` | 想读 |

应用侧 #229 已在 `Summary` 与 `deriveDashboardStats` 派生：`totalAlbums`／`listenedAlbums`／`wantAlbums`／`totalBooks`／`readBooks`／`readingBooks`／`wantBooks`（**未改 UI**）。

---

## 4. 原型

`MOCK_SUMMARY` 使用上表七字段（顺序与 #229 一致）驱动 A／B／C。

| 媒体 | 展示 |
| --- | --- |
| 专辑 | 总数（`total_albums`）· 已听（`listened_albums`）· 想听（`want_albums`） |
| 图书 | 总数 · 已读 · 在读 · 想读 |
| 标题完成进度 | 仅影视 |

空态：图书全 0 +「暂无收录」。

---

## 5. 三方案

| 方案 | 布局 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A 四格并列** | 2×2 等权 | 四类对等 | 空类占大卡 |
| **B 主次两层** | 影视主 + 音书次 | 改动小 | 音书偏次 |
| **C 密度行（推荐）** | 每类一行 | 贴合七列、空态轻、手机好扫 | 与现网大卡略有落差 |

**推荐 C。** 前端落地可直接读 `summary`／`deriveDashboardStats` 新字段，无需再调 `get_media_stats`。

---

## 6. 分工

| 项 | 谁 |
| --- | --- |
| `release_year_stats` 七列 + `Summary`／stats 派生 | **后端 PR #229** |
| 标题区／总览 UI | 前端另开（本分支不做） |
| 本分支 | 原型 + 报告 + 截图 · **不开 PR** |
