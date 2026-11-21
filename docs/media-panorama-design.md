# 媒体全景：音乐／图书纳入 — 设计调研（定稿）

> 临时分支 `cursor/media-panorama-design-bf63` · **不开 PR** · 不改 `main` · 不碰生产库／环境变量  
> **站长选定方案 A（四格并列）**

定稿原型：`/design/media-panorama/a`  
定稿截图：`panorama_final_a_1440.png` · `panorama_final_a_390.png`

---

## 1. 现网

标题区＋总览读 `release_year_stats`（经 `getCachedReleaseYearStats` → `deriveDashboardStats`）。现网仅电影／电视；完成进度只算影视片长。

---

## 2. 定稿数据形状

### 音乐（按歌曲 · 凝霜即将新增）

| 列名 | 含义 | 单位 |
| --- | --- | --- |
| `total_tracks` | 全部歌曲（**含专辑内曲目与单曲**） | 首 |
| `listened_tracks` | 已听 | 首 |
| `want_tracks` | 想听 | 首 |

**不再使用** `#229` 的 `total_albums`／`listened_albums`／`want_albums` 做全景音乐格。

### 图书（PR [#229](https://github.com/nopaiseh/bingetrack.ing/pull/229)）

| 列名 | 含义 | 单位 |
| --- | --- | --- |
| `total_books` | 总数 | 本 |
| `read_books` | 已读 | 本 |
| `reading_books` | 在读 | 本 |
| `want_books` | 想读 | 本 |

### 完成进度

仍只算影视片长；音乐／图书不并入。

### 想听／想读是否已有？

- 曲目／图书 `tracking.want_to_watch` 现网已有；文案为想听／想读。
- 年统计歌曲三列由凝霜新增；图书四列见 #229（`want_*` 仅计显式 `want_to_watch`，无 tracking 不计）。

---

## 3. 方案 A（定稿）

- 标题区：电影／电视／音乐／图书总计 + 影视完成进度  
- 总览 2×2：  
  - 电影：已看／想看（部）  
  - 电视：已看／在看／想看（部 + 季集）  
  - **音乐：已听／想听（首）**  
  - 图书：已读／在读／想读（本；0 时「暂无收录」）

曾对比过 B（主次两层）、C（密度行）；站长选定 **A**。

---

## 4. 前端落地提示（本分支不做）

1. 等凝霜落地 `total_tracks`／`listened_tracks`／`want_tracks` 后，与 #229 图书列一并读入 `summary`。  
2. `DashboardIntro` 加音乐／图书总计；`OverviewBoards` 扩为四格；音乐量词「首」。  
3. 勿再用专辑三列驱动全景音乐格。

---

## 5. 本分支范围

仅方案 A 原型 mock＋报告＋定稿截图；**不开 PR**。
