-- 删除 person_role 枚举及过渡用隐式 cast；所有角色比较已改为 text／credit_roles。
-- 合并后会通过 Supabase GitHub 集成自动上 prod。

-- 卸掉过渡 cast（若存在）。系统内置 IO cast 不会出现在 pg_cast 的可删条目中。
do $$
begin
  if exists (
    select 1 from pg_cast
    where castsource = 'public.person_role'::regtype
      and casttarget = 'text'::regtype
      and castcontext = 'i'
  ) then
    execute 'drop cast (public.person_role as text)';
  end if;
end $$;

-- 确认无列／函数参数再依赖 person_role
do $$
declare
  deps text;
begin
  select string_agg(format('%s.%s', n.nspname, c.relname), ', ')
  into deps
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where a.atttypid = 'public.person_role'::regtype
    and not a.attisdropped
    and n.nspname = 'public';
  if deps is not null then
    raise exception 'Cannot drop person_role: still used by columns: %', deps;
  end if;
end $$;

drop type if exists public.person_role;

comment on table public.credit_roles is
  '演职角色字典（person_role 枚举已移除）。media_credits.role → credit_roles.code。';
