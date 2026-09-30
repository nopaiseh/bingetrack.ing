# 缓存与 Vercel 写入用量

公开页面靠 ISR 和 Next.js 数据缓存（`unstable_cache`）减少数据库查询。二者在 Vercel 上每写一次都计入 **ISR write units**。2026 年 9 月用量曾接近 200,000，原因有两个，均已修复：

1. 非法详情地址（如 `/movies/wp-login.php`）被渲染成 200 的「未找到」页面，每个地址各写一次 ISR。现在 `proxy.ts` 在渲染前直接返回 404。
2. 每次管理保存都让全站页面和数据缓存失效。现在只失效受影响的条目（`lib/admin/revalidate-media.ts`）。

改公开页面、缓存或管理端写入逻辑前，先读完本文。

## 公开路由

| 路由 | 渲染方式 | 说明 |
| --- | --- | --- |
| `/`、`/movies`、`/shows`、`/sitemap.xml` | 静态 + ISR，`revalidate = 86400` | 页面本身不带缓存标签，由管理写入按路径刷新 |
| `/movies/[id]`、`/shows/[id]` | 按需 ISR，`generateStaticParams` 返回空数组 | 首次访问时生成，之后缓存 24 小时 |
| `/shows/[id]/seasons/[seasonId]` | 动态 | 读取分页／筛选参数，每次请求渲染；电视节目与季摘要走数据缓存 |
| `/search` | 动态 | 首屏结果只对部分条件走数据缓存（见下） |
| `/api/media` | 动态 | `s-maxage=30, stale-while-revalidate=120`，只有 CDN 缓存，不写数据缓存 |
| `/api/top-media` | 动态 | `s-maxage=60`，底层数据走数据缓存 |

`npm run build` 输出的路由表标出了每条路由是 ○（静态）、●（SSG）还是 ƒ（动态），以及 revalidate 时间。改动公开页面后应对比前后的路由表，确认没有意外变化。

## 数据缓存

定义在 `lib/functions/cached-media.ts` 和 `lib/functions/search-options.ts`：

| 数据 | key | 有效期 | 标签 |
| --- | --- | --- | --- |
| 条目详情 | `public-media-detail-v3` + ID | 24 小时 | `media`、`media:item:<id>` |
| 电视节目的季摘要 | `public-media-seasons-v3` + ID | 24 小时 | `media`、`media:item:<id>` |
| 搜索首屏 | `public-media-search-v3` + 查询串 | 1 小时 | `media`、`media:lists` |
| 榜单 | `public-media-top-v3` + 类型／年份／数量 | 24 小时 | `media`、`media:lists` |
| 即将上映、分布统计、年度统计 | `public-media-*-v2` | 24 小时 | `media`、`media:lists` |
| 搜索筛选选项 | `search-options-v2` | 24 小时 | `media`、`media:lists` |

非法 ID 在进入数据缓存前就返回，不会写入缓存条目。

搜索首屏只在以下条件同时满足时走数据缓存：没有关键词、第一页、没有年份范围、类型／地区／语言各至多一个已知值。这覆盖了详情页标签链接等常见入口。翻页、年份、多选等组合直接查询数据库：`/search` 本来就是动态渲染，不缓存不产生写入；如果缓存它们，每个组合都会各写一条缓存条目。

## 写入后的失效

| 操作 | 失效范围 |
| --- | --- |
| 保存、删除影视条目，修改系列成员 | `revalidateMediaItems`：条目本身、所属电视节目、同系列的其他作品各自的 `media:item:<id>`，加上 `media:lists`，再按路径刷新 `/`、`/movies`、`/shows`、`/sitemap.xml` |
| 修改或删除人物、类型、地区、语言、系列；报告批量删除；合并人物；「刷新缓存」按钮 | `revalidateAllMedia`：`media` 标签 + `revalidatePath("/", "layout")`，全站失效 |
| 标记「不是同一人」 | 不影响公开数据，不失效 |

受影响条目要在保存**前后**各查一次（`affectedMediaIds`），才能覆盖移出系列或更换上级的情况。查询失败时退回全站失效。

失效本身不产生写入；失效后的页面或数据在**下一次被访问时**重新生成，那时才计入写入。所以全站失效的代价约等于「之后被访问到的页面数」。

## 改动守则

以下改动会让写入量上升，需要先评估：

- **修改 `unstable_cache` 的 key 字符串**（例如 `-v3` 改成 `-v4`）：旧条目全部作废，每个被访问的 key 重新写一次。只在缓存数据结构确实变了时才这样做。
- **缩短 `revalidate`**：写入频率按比例上升。
- **在公开页面读取 `cookies()`、`headers()` 或 `searchParams`**：页面会变成动态渲染。这本身不写 ISR，但失去缓存后每次访问都查询数据库。
- **把动态页面改成静态或 ISR**：每个不同的地址都会写入缓存，要先确认地址数量有上限。
- **把用户可以任意构造的参数放进缓存 key**：必须先把取值收敛到有限集合，参照搜索首屏的做法。
- **扩大失效范围**：新写入操作能确定受影响条目时，用 `revalidateMediaItems`，不要默认用全站失效。
- **修改 `proxy.ts` 的 matcher**：合法的 UUID 详情页不能经过 proxy，否则会失去 ISR；非 UUID 的详情路径必须在渲染前返回 404。
- **删除详情页的 `loading.tsx`**：会改变流式渲染和状态码的行为，需要重新评估未找到页面的缓存方式。

另外，每次生产部署后，ISR 页面会在首次访问时重新生成。多个改动尽量合进一次发布。

## 已知的剩余写入来源

- 格式合法（UUID）但不存在的详情 ID，以及用电影 ID 访问 `/shows/<id>` 这类类型不符的地址，仍会以 200 状态渲染「未找到」页面并写入 ISR。已删除条目的旧链接被重新抓取时会出现这种情况。数量通常很少；如果将来成为主要来源，需要单独设计方案，例如由 proxy 查询存在性，或者调整 `loading.tsx` 的使用方式。
