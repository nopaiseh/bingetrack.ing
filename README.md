# Media dashboard

这个项目的 Supabase 查询已尽量改为使用 `v_all_media` 视图，核心数据层在 `lib/functions` 中统一处理，减少不同页面重复拼接原始表数据。

## 关键约定

- 视图优先：主列表与详情页优先读取 `v_all_media`
- 统一映射：`lib/functions/media-mapper.ts` 负责把 Supabase 视图数据转换为前端 `Media` 类型
- 运行环境：项目需要设置 Supabase 相关环境变量

## 环境变量

```bash
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="xxx"
SUPABASE_SERVICE_ROLE_KEY="xxx"
```

## 启动命令

```bash
npm install
npm run dev
```

## 说明

如果后续新增媒体字段，推荐先扩展 `v_all_media`，再补充 `Media` 类型和 `mapSupabaseToMedia` 的映射逻辑，避免页面重复硬编码字段。