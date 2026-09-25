-- 让 search_media 可被规划器内联：带 SET 子句的 SQL 函数无法内联，每次调用都作为黑盒完整计算，
-- PostgREST 叠加的状态、类型标签、排序和分页也无法下推。去掉固定 search_path 后，本地实测一页搜索
-- （含规划）由约 7.1 ms 降至约 3.6 ms。
--
-- 安全性：函数以调用者权限运行（security invoker），函数体内所有对象均带 public. 前缀，
-- 运算符解析始终先搜索 pg_catalog，因此不存在通过 search_path 劫持的风险。
alter function public.search_media(text, text[], boolean, text[]) reset search_path;
