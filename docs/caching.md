# 缓存与 Vercel 写入用量

公开页面靠 ISR 和 Next.js 数据缓存（`unstable_cache`）减少数据库查询。二者在 Vercel 上每写一次都计入 **ISR write units**。2026 年 9 月用量曾接近 200,000，原因有两个，均已修复：

1. 非法详情地址（如 `/movies/wp-login.php`）被渲染成 200 的「未找到」页面，每个地址各写一次 ISR。现在 `proxy.ts` 在渲染前直接返回 404。
2. 每次管理保存都让全站页面和数据缓存失效。现在只失效受影响的条目（`lib/admin/revalidate-media.ts`）。

改公开页面、缓存或管理端写入逻辑前，先读完本文。

## 公开路由

| 路由                                | 渲染方式                                    | 说明                                                                                                                                    |
| ----------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                 | 静态 + ISR，`revalidate = 3600`             | 倒计时天数按新加坡日历日计算。24 小时会让“今天”在午夜后陈旧一整天，故缩短到 1 小时；页面本身不带缓存标签，管理写入仍按路径刷新          |
| `/movies`、`/shows`、`/sitemap.xml` | 静态 + ISR，`revalidate = 86400`            | 页面本身不带缓存标签，由管理写入按路径刷新                                                                                              |
| `/movies/[id]`、`/shows/[id]`       | 按需 ISR，`generateStaticParams` 返回空数组 | 首次访问时生成，之后缓存 24 小时                                                                                                        |
| `/shows/[id]/seasons/[seasonId]`    | 按需 ISR，`generateStaticParams` 返回空数组 | 默认季页（第 1 页、全部、升序）首次访问时生成，之后缓存 24 小时。页面不读取分页或筛选参数；节目详情、季摘要、单集分页和下一集走数据缓存 |
| `/music/[id]`、`/people/[id]`       | 按需 ISR，`generateStaticParams` 返回空数组 | 歌曲／人物详情：只靠标签失效，不定时重建；无顶层 `/music`／`/people` 目录页                                                             |
| `/search`                           | 动态                                        | 首屏结果只对部分条件走数据缓存（见下）                                                                                                  |
| `/api/media`                        | 动态                                        | `s-maxage=30, stale-while-revalidate=120`，只有 CDN 缓存，不写数据缓存                                                                  |
| `/api/top-media`                    | 动态                                        | `s-maxage=60`，底层数据走数据缓存；条数固定为 10，类型为 `movie`／`tv_show`／`album`／`book`，缓存键只随类型和年份变化                  |

`npm run build` 输出的路由表标出了每条路由是 ○（静态）、●（SSG）还是 ƒ（动态），以及 revalidate 时间。改动公开页面后应对比前后的路由表，确认没有意外变化。

首页倒计时天数在服务端用 Asia/Singapore 的日历日现算，页面 HTML 和 RSC 一起缓存，所以这个日期跟 `revalidate` 走，不能只缩短数据缓存。选 3600 秒是因为“今天”一天变一次，1 小时把午夜后的陈旧限制在大约一小时，再加过期后的第一次 stale-while-revalidate 请求。这是单条路由，有访问时最多大约每天 24 次 ISR 写入。年度统计、榜单、分布与首页继续等聚合数据是仅标签失效的数据缓存；即将上映候选池仍定时 24 小时重建。重新生成页面时通常命中这些数据缓存。候选池从 UTC 昨天起取，24 小时内仍包含新加坡的今天。管理端保存照旧 `revalidatePath("/")`。

## 数据缓存

定义在 `lib/functions/cached-media.ts` 和 `lib/functions/search-options.ts`（系列降级见 `lib/functions/cache-degrade.ts`）。`revalidate: false` 表示不定时重建，只靠后台写入时的 `revalidateTag` 失效。

| 数据                         | key                                                                      | 有效期     | 标签                                  |
| ---------------------------- | ------------------------------------------------------------------------ | ---------- | ------------------------------------- |
| 影视／图书条目详情           | `public-media-detail-v4` + ID                                            | 仅标签失效 | `media`、`media:item:<id>`            |
| 专辑详情                     | `public-album-detail-v3` + ID                                            | 仅标签失效 | `media`、`media:item:<id>`            |
| 歌曲详情                     | `public-song-detail-v1` + ID                                             | 仅标签失效 | `media`、`media:item:<id>`            |
| 人物详情                     | `public-person-detail-v1` + ID                                           | 仅标签失效 | `media`、`person`、`person:item:<id>` |
| 电视节目的季摘要             | `public-media-seasons-v3` + ID                                           | 仅标签失效 | `media`、`media:item:<id>`            |
| 单集分页与季统计             | `public-season-episodes-v2` + 节目 ID／季 ID／页码／每页条数／状态／排序 | 仅标签失效 | `media`、`media:item:<节目 ID>`       |
| 下一集                       | `public-season-next-episode-v1` + 节目 ID／季 ID                         | 仅标签失效 | `media`、`media:item:<节目 ID>`       |
| 搜索首屏                     | `public-media-search-v3` + 查询串                                        | 1 小时     | `media`、`media:lists`                |
| 榜单                         | `public-media-top-v4` + 类型／年份／条数（固定 10；类型含 album／book）  | 仅标签失效 | `media`、`media:lists`                |
| 即将上映                     | `public-media-upcoming-v2`                                               | 24 小时    | `media`、`media:lists`                |
| 分布统计                     | `public-media-distributions-v2`                                          | 仅标签失效 | `media`、`media:lists`                |
| 年度统计                     | `public-media-release-year-stats-v2`                                     | 仅标签失效 | `media`、`media:lists`                |
| 首页继续（在看／在听／在读） | `public-media-home-continue-v2`                                          | 仅标签失效 | `media`、`media:lists`                |
| 首页在读（单独入口）         | `public-media-currently-reading-v1`                                      | 仅标签失效 | `media`、`media:lists`                |
| 图书目录统计                 | `public-book-stats-v1`                                                   | 仅标签失效 | `media`、`media:lists`                |
| 专辑目录统计                 | `public-album-stats-v1`                                                  | 仅标签失效 | `media`、`media:lists`                |
| 搜索筛选选项                 | `search-options-v2`                                                      | 仅标签失效 | `media`、`media:lists`                |

非法 ID 在进入数据缓存前就返回，不会写入缓存条目。电影／节目／图书详情走 `getCachedMediaById`（`public-media-detail-v4`）；专辑详情走 `getCachedAlbumDetail`（`public-album-detail-v3`）；歌曲详情走 `getCachedSongDetail`（`public-song-detail-v1`，RPC `get_song_detail`）；人物详情走 `getCachedPersonDetail`（`public-person-detail-v1`，people 行 + RPC `get_person_works`）。

### 系列查询降级（不写数据缓存，也不写页面缓存）

影视／图书详情与专辑详情在加载系列／同系列成员时，若查询失败，会标记 `seriesDegraded` 并在缓存回调里抛出 `SeriesDegradedError`（`throwIfSeriesDegraded`）。`unstable_cache` 因此不会把「空系列」结果写入数据缓存。外层 `cachedWithSeriesFallback` 接住该错误后，改走无缓存路径（`getMediaById`／`getAlbumDetail`），返回空系列并照常 `reportHandledError`。其他错误仍向上抛出。

系列查询降级时，该次渲染的页面也不进入 Full Route Cache／ISR：回退路径在 `unstable_cache` 之外调用 `connection()`（`skipFullRouteCacheForSeriesDegrade`，见 `lib/functions/cache-degrade.ts`），仅让这一次详情页渲染走请求时动态输出。电影／剧集／书详情页的同系列横滑走 `getRelatedBySeries`（不经 `cachedWithSeriesFallback`），该函数在 `seriesDegraded: true` 时同样先调用 `skipFullRouteCacheForSeriesDegrade` 再返回空列表；专辑详情已由 `loadAlbumDetail` 路径覆盖。未降级时详情页原有 `revalidate` 与 tag 失效不变。不要在 `unstable_cache` 回调里调用 `connection()`／`cookies()`／`headers()`。

首页继续没有查询参数，全站共用一条缓存，键为 `public-media-home-continue-v2`，读取函数是 `getHomeContinue`，返回 `{ watching, listening, reading }`（`HomeContinueData`）。只用公开 Supabase 客户端，不读 `cookies()`、`headers()` 或当前用户：进度对访客和站长是同一份公开数据，不是按人分开的。缓存回调因此可以放进 `unstable_cache`。`getCachedCurrentlyReading` 另有独立键，供单独取在读列表。

类型、地区、语言筛选必须是现有选项：`/search` 遇到未知值返回未找到页面，`/api/media` 返回 400。

搜索首屏只在以下条件同时满足时走数据缓存：没有关键词、第一页、没有年份范围、类型／地区／语言各至多一个值。这覆盖了详情页标签链接等常见入口。翻页、年份、多选等组合直接查询数据库：`/search` 本来就是动态渲染，不缓存不产生写入；如果缓存它们，每个组合都会各写一条缓存条目。

## 写入后的失效

| 操作                                                                                   | 失效范围                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 保存、删除影视／音乐／图书条目（含级联删掉的观看记录），批量修改观看状态，修改系列成员 | `revalidateMediaItems`：条目本身、所属电视节目、曲目所属专辑、专辑下曲目、同系列其他作品各自的 `media:item:<id>`，加上 `media:lists`，再按路径刷新目录页                                         |
| 保存媒体（credits／作者变更）                                                          | 同上，另用 RPC 返回的 `affected_person_ids` 调用 `revalidatePersonItems`（专辑／曲目／图书／影视均如此）                                                                                         |
| 删除媒体                                                                               | 同上，删除前经 `creditedPersonIds` 查出演职员（专辑含其曲目），再 `revalidatePersonItems`；查询失败（返回 `null`）时退回 `person` 全站标签，与 `revalidateMediaItems(null)` 对称，避免漏刷人物页 |
| 修改或删除人物；合并人物                                                               | `revalidateMediaItems`（经 `referenceMediaIds` 找关联作品）+ `revalidatePersonItems`（编辑／删除用该人物 id；合并用保留与被删双方 id）                                                           |
| 修改或删除类型、地区、语言、系列；报告批量删除闲置资料                                 | `revalidateMediaItems`（关联作品或空列表刷新聚合）；闲置资料无详情页波及                                                                                                                         |
| 「刷新缓存」按钮                                                                       | `revalidateAllMedia`：`media` 标签 + `revalidatePath("/", "layout")`，全站失效                                                                                                                   |
| 标记「不是同一人」                                                                     | 不影响公开数据，不失效                                                                                                                                                                           |

人物公开详情挂 `person`（全站）与 `person:item:<id>`。保存／删除作品或编辑／删除／合并人物后会失效；删除媒体时若 `creditedPersonIds` 失败则失效 `person` 全站标签。若未走到上述路径，人物页「歌曲」区可能仍显示旧专辑封面，直到该人物标签失效或手动「刷新缓存」。

读取 `media_credits`（及删除前的 `album_tracks` 扩展）时用 `.range` 翻页读完，避免 PostgREST 默认 1000 行上限静默截断演职员列表，导致人物页漏刷或专辑／编辑页 credits 不完整。

电影和单集的观看写入都走上面第一行，不另建标签。保存条目时评分决定已看或想看（`manage_save_media` 写 `tracking`），批量操作直接改 `tracking.status`，删除会级联去掉观看记录。成功之后 `revalidateMediaItems` 调用 `revalidateTag("media:lists", { expire: 0 })`。首页继续挂着这个标签，同时首页路径被 `revalidatePath("/")` 刷新，下一次访问不会继续用旧的 HTML，也不会从仅标签失效的数据缓存里读回旧进度。没有写进数据库的失败请求不失效。查询受影响条目失败时退回 `revalidateAllMedia`，失效 `media` 标签，首页继续同样过期。手动「刷新缓存」也走 `media` 标签。绕过网站、直接在 Supabase 里改数据（例如用 SQL 或运维脚本改 `tracking`）不会触发失效；首页继续是 `revalidate: false`，会一直用旧进度直到标签失效，请在管理台点现有的「刷新缓存」。

受影响条目要在保存**前后**各查一次（`affectedMediaIds`），才能覆盖移出系列或更换上级的情况。查询失败时退回全站失效。

失效本身不产生写入；失效后的页面或数据在**下一次被访问时**重新生成，那时才计入写入。所以全站失效的代价约等于「之后被访问到的页面数」。

## 改动守则

以下改动会让写入量上升，需要先评估：

- **修改 `unstable_cache` 的 key 字符串**（例如 `-v3` 改成 `-v4`）：旧条目全部作废，每个被访问的 key 重新写一次。只在缓存数据结构确实变了时才这样做。
- **缩短 `revalidate`**：写入频率按比例上升。
- **在公开页面读取 `cookies()`、`headers()` 或 `searchParams`**：页面会变成动态渲染。这本身不写 ISR，但失去缓存后每次访问都查询数据库。
- **系列查询降级**：见上文「系列查询降级」；降级时数据缓存与该次页面渲染都不写入，未降级路径不要改成常驻动态。
- **把动态页面改成静态或 ISR**：每个不同的地址都会写入缓存，要先确认地址数量有上限。
- **把用户可以任意构造的参数放进缓存 key**：必须先把取值收敛到有限集合，参照搜索首屏的做法。
- **扩大失效范围**：新写入操作能确定受影响条目时，用 `revalidateMediaItems`，不要默认用全站失效。
- **修改 `proxy.ts` 的 matcher**：合法的 UUID 详情页（含季页、歌曲、人物）不能经过 proxy，否则会失去 ISR；非 UUID 的节目 ID、季 ID、歌曲 ID 或人物 ID 必须在渲染前返回 404。
- **删除详情页的 `loading.tsx`**：会改变流式渲染和状态码的行为，需要重新评估未找到页面的缓存方式。

另外，每次生产部署后，ISR 页面会在首次访问时重新生成。多个改动尽量合进一次发布。

## 已知的剩余写入来源

- 格式合法（UUID）但不存在的详情 ID，以及用电影 ID 访问 `/shows/<id>` 这类类型不符的地址，仍会以 200 状态渲染「未找到」页面并写入 ISR。已删除条目的旧链接被重新抓取时会出现这种情况。数量通常很少，目前有意不处理：

- `loading.tsx` 一开始流式输出，状态码就固定为 200（见 `node_modules/next/dist/docs/01-app/02-guides/streaming.md` 的「The HTTP contract」）。
- 要在渲染前返回真正的 404，只能让 proxy 对每个 UUID 详情地址查一次数据库。这样合法详情页也会多一次函数调用和数据库往返，代价比这些写入大。

如果将来它成为主要写入来源，可以考虑由 proxy 查询一份带缓存的 ID 列表。
