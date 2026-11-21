# 搜索人物角色筛选：调查与方案

基准文案按 PR #247 之后：全部、电影、电视节目、专辑、单曲、图书、系列、导演、演员。  
本报告只做调查与设计预览，**未开 PR、未改后端／数据库**。预览用示例筛选状态，不接真实搜索结果。

---

## 1. 调查结论

### 1.1 「导演」「演员」实际在做什么

| 问题 | 结论 |
|------|------|
| 搜人物还是搜作品？ | **搜作品**。按 `people` 姓名／别名命中后，返回关联的 `media_items`（电影／剧等），没有独立人物结果页。 |
| 数据从哪来？ | `media_credits`（`role` = `director` / `actor`）→ `people`。 |
| URL／前端 | 分类芯片 `type=director` / `type=actor`（与 movie／book 混在同一 `type` 参数）。 |
| API | `buildMediaSearchQuery` 把它们拆成 `creditRole=director,actor`。 |
| 查询 | `search_media(p_query, p_types, p_series_only, p_credit_roles)` 在 credits 上按角色 + 人名 `ilike` 匹配。 |

验证：`search_media('诺兰', '{}', false, '{director}')` → 《盗梦空间》（导演：克里斯托弗·诺兰）。

补充行为：

- **必须有关键词**才会走 `search_media` 的人物匹配；只点「导演」、不输入名字时，列表层几乎不按角色过滤。
- 选了「导演」后，标题匹配被关掉（`searched_types` 为空），只靠人物角色命中。

### 1.2 各角色：类型／字段／现有数据／能否搜

`person_role` 枚举已有：`actor` · `director` · `author` · `artist` · `composer` · `lyricist`。

| 角色 | DB／视图 | 生产数据（Media Vault） | 无分类关键词搜人名 | 分类芯片按角色搜 |
|------|----------|-------------------------|--------------------|------------------|
| 导演 | `media_credits.role=director`；`v_all_media.directors` | 135 条／99 人／99 部 | ✅（all_categories） | ✅ 前端已接 |
| 演员 | `role=actor`；`casts` | 1630／1109／99 | ✅ | ✅ 前端已接 |
| 作者 | `role=author`；`v_all_media.authors` | **0**（图书表 0 行） | ✅ 代码路径有；**无数据可验** | ❌ 芯片无；repo 还会剥掉 |
| 歌手 | `role=artist`；`artists` | **0**（专辑／单曲 0） | ✅ 代码路径有 | ❌ 同上 |
| 作词 | `role=lyricist` | **0** | ❌ **未**进 all_categories | ❌ API 白名单也无 |
| 作曲 | `role=composer` | **0** | ❌ 同上 | ❌ 同上 |

生产现状：仅有电影／电视及导演／演员 credits；`books`／`music_albums` 表存在但为空。

### 1.3 关键词搜作者名能否搜到书？

- **不选分类、只输作者名**：`search_media` 的 all_categories 含 `author`，**理论上能**按作者名命中图书（有数据后）。
- **先选「图书」再输作者名**：**不能**按作者命中。一旦 `p_types` 非空且未传 `p_credit_roles`，`searched_roles` 为空，只匹配标题／别名。  
  → 老公「想搜图书作者该选哪个」：现状应选**全部（或不选分类）**再搜人名；选「图书」反而关掉人物匹配。没有「作者」芯片。

### 1.4 管线缺口（前端已接 vs 后端已准备）

| 层 | 现状 |
|----|------|
| UI `TYPE_OPTIONS` | 仅 `director`／`actor` |
| `search-state` `TYPE_VALUES`／映射 | 仅导演／演员 → `creditRole` |
| API `CREDIT_ROLES` | `director, actor, author, artist`（**无** lyricist／composer） |
| `media-repo` | **再过滤成仅 director／actor**，即使 API 传入 author／artist 也会被丢掉 |
| `search_media` all_categories | `director, actor, artist, author`（**无** lyricist／composer） |
| 管理端写入 | 图书 authors；单曲 artists／lyricists／composers 已可存 |

---

## 2. 方案说明

预览页（本地示例，不接搜索）：`/design/search-person-filters?option=a|b|c`

### 方案 A · 分类行直接加角色芯片

- 分类：…系列、导演、演员、**作者、歌手、作词、作曲**（共 13 项 + 全部）
- 390：分类约 **4 行**；扫描成本高，作品类型与人物角色混在一行，语义不清
- 优点：与现有导演／演员交互一致，改动面最小
- 缺点：手机拥挤；「图书 + 作者」仍要教用户懂 OR 语义

### 方案 B ·「人物」+ 角色子行

- 分类用单个「人物」替换导演／演员等；选中后出现「角色」：导演／演员／作者／歌手／作词／作曲
- 390：分类约 2 行；角色约 2 行
- 优点：主行短；角色可扩展
- 缺点：多一步；「人物」未选时角色不可见；URL 需约定 `type=person` + 角色参数

### 方案 C · 分类与人物分行（推荐）

- **分类**：仅作品类型 + 系列  
- **人物**（始终可见）：导演、演员、作者、歌手、作词、作曲  
- 390：分类／人物各约 2 行；与「状态」「排序」同一套行式芯片
- 优点：作品 vs 人物语义清晰；作者入口常驻；可与「图书」组合（后端需定义组合语义）；无额外点击
- 缺点：面板多一行（桌面可接受）

**推荐 C。** 兼顾老公「按作者／歌手／作词／作曲搜」的发现性，又避免 A 的芯片爆炸和 B 的隐藏子筛选。

---

## 3. 截图路径

| 方案 | 1440 | 390 |
|------|------|-----|
| A | `/opt/cursor/artifacts/option-a-1440.png` | `/opt/cursor/artifacts/option-a-390.png` |
| B | `/opt/cursor/artifacts/option-b-1440.png` | `/opt/cursor/artifacts/option-b-390.png` |
| C | `/opt/cursor/artifacts/option-c-1440.png` | `/opt/cursor/artifacts/option-c-390.png` |

副本：`design-artifacts/`（同文件名）。  
390 换行：A 分类 ~4 行；B／C 各段 ~2 行。

---

## 4. 各方案改动清单

### 4.1 前端（实装时；本任务未改生产搜索）

**共用**

- `search-model`／`ActiveFilterBar`：芯片与文案（歌手 vs 艺人等）
- `search-state`：白名单；`type`／独立 `person` → `creditRole`
- 无障碍：`aria-pressed`、角色行 `aria-label`；可选 `role="group"`
- 测试：`search-state`／`search-model`／filter-bar
- 占位文案可补「作者、歌手…」（非必须）

**A**：`TYPE_OPTIONS` 追加 author／artist／lyricist／composer；映射进 `creditRole`  
**B**：分类加 `person`；条件渲染角色行；URL 如 `type=person&creditRole=author` 或 `person=author`  
**C**：分类去掉导演／演员；新增「人物」行（可复用 `FilterOptionRow`）；人物多选 → `creditRole`

### 4.2 后端（仅报告，由后端同事做）

**A／B／C 共用（要让新角色真正可搜）**

1. `media-repo`：`p_credit_roles` 放行 `author`／`artist`／`lyricist`／`composer`（勿再只留导演／演员）
2. API `CREDIT_ROLES`：补 `lyricist`／`composer`（author／artist 已在白名单）
3. `search_media`：all_categories 的 `searched_roles` 加上 `lyricist`／`composer`（否则无分类时作词／作曲人名搜不到）
4. 明确组合语义（建议写入注释／测试）：
   - 仅人物角色 + 关键词 → 按角色搜人名，返回作品（同现导演）
   - 人物 + 媒体类型（如图书 + 作者）→ 人名命中 **且** `type` 限制；或文档化为「类型收窄结果」
   - 仅媒体类型 + 关键词 → 是否仍搜该类型下的 credits（现状：**不搜**；若产品要「在图书里搜作者」需改 SQL）
5. 数据：导入／录入图书作者、专辑／单曲歌手／作词／作曲；无数据则芯片可用但结果空
6. 测试：`search_media` SQL／API 对 author／artist／lyricist／composer 的用例
7. （可选）无关键词时按角色浏览：今日导演芯片无 q 也不过滤，若要「列出某导演全部作品」需另设计

**B 额外**：解析 `type=person`（或等价），避免把它当成 `media_type`

**C 额外**：若人物不用 `type=` 而用独立参数，API／缓存键与 `hasOnlyKnownFilterValues` 同步

**不必改（已有）**：`person_role` 枚举；`media_credits`；管理端按角色写入；`v_all_media.authors`／`artists` 列（有数据后展示用）

---

## 5. 预览说明

- 本地：`next build && next start`，打开上述 design 路由
- 筛选交互为示例；**未**改 `/search` 生产逻辑、未迁库、未开 PR
