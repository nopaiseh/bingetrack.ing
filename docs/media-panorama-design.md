# 媒体全景：音乐／图书纳入 — 设计调研

> 临时分支 `cursor/media-panorama-design-bf63` · 仅调研与原型 · **不开 PR** · 不改 `main` · 不碰生产库／环境变量

原型路由（本地）：

- `/design/media-panorama/a` — 四格并列
- `/design/media-panorama/b` — 主次两层
- `/design/media-panorama/c` — 密度行

截图见 artifacts：`panorama_{a|b|c}_{1440|390}.png`

---

## 1. 现状

### 组件与数据流

| 层 | 位置 | 作用 |
| --- | --- | --- |
| 页面 | `app/page.tsx` | ISR；`getCachedReleaseYearStats()` → `summary` |
| 看板 | `app/HomeDashboard.tsx` | 年份切换；`deriveDashboardStats(summary, year, …)` |
| 标题区 | `components/dashboard/DashboardIntro.tsx` | 「媒体全景」+ 三项：电影总计／电视节目总计／完成进度 |
| 总览 | `components/dashboard/OverviewBoards.tsx` | 电影看板（已看／想看）+ 电视节目看板（已看／在看／想看 + 季集细节） |
| 推导 | `components/dashboard/dashboard-stats.ts` | 从 `Summary` 算总数与进度 |
| 数据源 | 视图 `public.release_year_stats` | **只聚合 movie + tv_show** |

标题区字段：

- 电影总计 = `watched_movies + unwatched_movies`
- 电视节目总计 = `watched_series + watching_series + unwatched_series`
- 完成进度 = `total_watched_runtime / total_runtime`（影视片长）

总览字段：

- 电影：已看、想看、观影完成度（部）
- 电视：已看／在看／想看（含季·集细节）、单集观看进度

文案入口：`components/watch-status.tsx`（影视）、`lib/listen-status.ts`（听过／想听／在听）、`READ_STATUS_DISPLAY`（读过／想读／在读）、`MEDIA_TYPE_DEFINITIONS.*.trackingLabels`。

### 音乐（专辑）与图书：现有表／查询

| 能力 | 专辑 `album` | 图书 `book` |
| --- | --- | --- |
| 元数据 | `media_items` + `music_albums` + 曲目 `music` | `media_items`（type=book） |
| 状态语义 | 曲目 `tracking` 汇总：`watched`→听过，`watching`→在听，`want_to_watch`→想听（见 `v_all_media`） | 条目 `tracking`：`watched`→读过，`in_progress`→在读，`want_to_watch`→想读 |
| 全量状态计数 | **`get_media_stats('album')`**（经 `v_all_media`） | **`get_media_stats('book')`**（已有 `getBookStats()`） |
| 首页「继续」 | `v_continue_listening` → 在听 | `tracking.status = in_progress` → 在读 |
| 按发行年汇总 | **`release_year_stats` 不含 album／book** | 同左 |
| 曲目／页数进度条细节 | 现 RPC 只有专辑状态计数，无「已听曲目／总曲目」年统计列 | 无页数进度；完成度可用「读过／总数」 |

### 现有查询能否直接撑起全景？

- **全时段四类状态卡：可以，前端加两次 RPC 即可**  
  - `get_media_stats('album')` → total / watched / watching / want  
  - `get_media_stats('book')` → total / watched / want / in_progress（`getBookStats` 已封装）  
  - 不必为「全时段总览」新建 RPC。
- **与现网年份选择器对齐（按年电影／电视那种）：不行，要后端扩展**  
  - 需扩展 `release_year_stats`（或新视图／RPC）加入 album／book 按年计数；否则音乐／图书只能挂「全时段」，或年份切换时影视变、音书不变（体验分裂）。
- **专辑「曲目进度」细节（对标电视季集）：现 RPC 没有**  
  - 若 UI 要「听过 14 张 · 186 曲」这类细节，需新增查询（例如按专辑汇总曲目 watched 计数）；可二期。
- **完成进度 %**：现口径是影视 runtime；音书无片长。建议标题区进度暂仍只算影视，或改为「四类完成条目加权」——产品取舍，非阻塞。

---

## 2. 三个前端方案

状态用语（贴现网数据）：

- 音乐：听过／在听／想听  
- 图书：读过／在读／想读  
- 量词：电影／电视「部」、音乐「张」、图书「本」  
- 空态：保留弱化卡 +「暂无收录」，不藏整块（避免布局跳变）

### 方案 A · 四格并列

- 标题区：四类总计  
- 总览：2×2 等权看板（电影／电视／音乐／图书）  
- **优点**：信息对等，和「光影、声音与文字」文案一致；扩展直观  
- **缺点**：图书为 0 时仍占一整格；桌面高于现网；完成进度被挤出标题主位

### 方案 B · 主次两层

- 标题区：保持电影／电视／完成进度；脚注带出音乐／图书总数  
- 主层：现网两张大看板；次层：「声音与文字」紧凑双卡  
- **优点**：改动面最小、视觉延续最强；音书体量小时不抢戏  
- **缺点**：音书永远次等；四类「全景」叙事偏弱

### 方案 C · 密度行（推荐）

- 标题区：四类短标签总计 + 影视完成进度  
- 总览：每类一行（体量 + 三态 + 细进度），手机可一屏扫完  
- **优点**：空态代价低；扫描快；后续加「音乐／图书」独立 tab 也不打架  
- **缺点**：与现网大卡风格略有落差；单行信息密度更高，需注意触控间距

---

## 3. 推荐

**推荐方案 C**，落地时可先只改总览 + 标题区统计，不动电影／电视独立 tab。

理由：

1. 站长诉求是「全景」纳入音书，不是把音书做成附属脚注 → C／A 优于 B。  
2. 图书（及早期音乐）很可能长期偏少或为 0 → C 的空态成本低于 A 的整卡空洞。  
3. 后端若暂不扩年统计，C 的行式布局更容易标注「全时段」而不破坏现网年份切换心智。

若站长明确「影视永远主视觉」，退而选 **B**。

---

## 4. 是否需要后端改动

| 范围 | 是否需要后端 | 说明 |
| --- | --- | --- |
| 全时段总览四类状态 | **否** | 复用 `get_media_stats('album'|'book')`；前端并行拉取并并入 `HomeDashboard` props |
| 标题区四类总数 | **否** | 同上 RPC 的 `total` |
| 按年切换音书统计 | **是** | 扩展 `release_year_stats` 或新 RPC；归后端 |
| 专辑曲目级进度文案 | **可选／是** | 现 RPC 无曲目合计；要细节则新查询 |
| 独立「音乐／图书」看板 tab + 分布／精选 | **是（另议）** | 分布视图与 top-media 目前按 movies／shows；本调研不纳入 |

**建议落地分两步**：  
1）前端用现有 RPC 做全时段四类（推荐 UI=C）；  
2）若要坚持年份切换一致，再开后端扩展 `release_year_stats`。
