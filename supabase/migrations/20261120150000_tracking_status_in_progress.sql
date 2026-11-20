-- 阅读进度状态：在读（in_progress）。
-- ALTER TYPE ... ADD VALUE 不能在同一事务中立刻使用新枚举值，故单独成文件；
-- 约束、触发器与 RPC 改写放在后续迁移。

alter type public.tracking_status add value if not exists 'in_progress';
