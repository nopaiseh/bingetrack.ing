-- PostgreSQL 默认把新函数的 EXECUTE 授予 PUBLIC，anon 也就能调用。按 schema 设置的默认权限只能追加、不能收回这一项，
-- 因此对 postgres 角色全局撤销：之后迁移新建的函数必须显式 grant 给需要的角色。

alter default privileges for role postgres revoke execute on functions from public;

-- 目前仅这两个报告辅助函数沿用了 PUBLIC 默认权限；它们只被只授权给 authenticated 的 v_report_* 视图（security_invoker）使用。
revoke execute on function public.manage_name_key(text) from public, anon;
revoke execute on function public.manage_name_issues(text, boolean) from public, anon;
grant execute on function public.manage_name_key(text) to authenticated;
grant execute on function public.manage_name_issues(text, boolean) to authenticated;
