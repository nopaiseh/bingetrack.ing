-- 权限守卫：用 pg_catalog / information_schema 动态枚举 public 对象，
-- 防止以后新增表、视图或函数时漏掉 RLS / 授权 / security_invoker / search_path。
-- admin_* 与 manage_* 函数均从目录动态发现；本文件只断言、不改权限。
-- 合理例外必须写进下方白名单并注释原因。

begin;

select plan(9);

-- ---------------------------------------------------------------------------
-- 白名单（当前为空）。新增例外时：对象名 + 一行原因；禁止为过测试去改迁移权限。
-- 说明：music / music_albums 曾是目录预留表，现已与其他媒体表一样启用 RLS、
-- 公开只读、站长写入（见 20261120000000_music_backend），故不在白名单。
-- ---------------------------------------------------------------------------
create temporary table permission_guard_rls_exempt (
  relname name primary key,
  reason text not null
);

create temporary table permission_guard_view_invoker_exempt (
  relname name primary key,
  reason text not null
);

create temporary table permission_guard_anon_write_exempt (
  relname name primary key,
  reason text not null
);

-- 1) public 下每张普通表 / 分区表都启用了 RLS
select is_empty(
  $$
    select c.relname::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
      and c.relname not in (select relname from permission_guard_rls_exempt)
    order by 1
  $$,
  'every public table has RLS enabled'
);

-- 2a) admin_*：按现有设计仅 authenticated 可 EXECUTE；anon / PUBLIC 不可。
--     现有：admin_save_media、admin_delete_media、admin_save_album_with_tracks
--     （均 revoke public/anon，grant authenticated）。
select is_empty(
  $$
    select format(
      '%I(%s) anon=%s authenticated=%s public=%s',
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid),
      has_function_privilege('anon', p.oid, 'EXECUTE'),
      has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      exists (
        select 1
        from pg_catalog.aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
    )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin\_%' escape '\'
      and p.prokind = 'f'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or exists (
          select 1
          from pg_catalog.aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      )
    order by 1
  $$,
  'admin_ functions: authenticated execute only; anon and PUBLIC denied'
);

-- 2b) anon / authenticated 对 admin_* 不得有 EXECUTE 以外的意外授权
select is_empty(
  $$
    select format('%I(%s) %s=%s',
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid),
      r.rolname,
      acl.privilege_type
    )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    join pg_catalog.pg_roles r on r.oid = acl.grantee
    where n.nspname = 'public'
      and p.proname like 'admin\_%' escape '\'
      and p.prokind = 'f'
      and r.rolname in ('anon', 'authenticated')
      and not (
        r.rolname = 'authenticated'
        and acl.privilege_type = 'EXECUTE'
      )
    order by 1
  $$,
  'admin_ functions grant anon/authenticated nothing beyond designed execute'
);

-- 2c) 至少存在一个 public.manage_* 函数，避免空集时权限断言静默通过
select ok(
  exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'manage\_%' escape '\'
      and p.prokind = 'f'
  ),
  'at least one public manage_ function exists'
);

-- 2d) manage_*：与 admin_* 相同——仅 authenticated 可 EXECUTE；anon / PUBLIC 不可。
--     从 pg_proc 动态枚举，新增 manage_* 会自动纳入检查。
select is_empty(
  $$
    select format(
      '%I(%s) anon=%s authenticated=%s public=%s',
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid),
      has_function_privilege('anon', p.oid, 'EXECUTE'),
      has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      exists (
        select 1
        from pg_catalog.aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
    )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'manage\_%' escape '\'
      and p.prokind = 'f'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or exists (
          select 1
          from pg_catalog.aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      )
    order by 1
  $$,
  'manage_ functions: authenticated execute only; anon and PUBLIC denied'
);

-- 2e) anon / authenticated 对 manage_* 不得有 EXECUTE 以外的意外授权
select is_empty(
  $$
    select format('%I(%s) %s=%s',
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid),
      r.rolname,
      acl.privilege_type
    )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    join pg_catalog.pg_roles r on r.oid = acl.grantee
    where n.nspname = 'public'
      and p.proname like 'manage\_%' escape '\'
      and p.prokind = 'f'
      and r.rolname in ('anon', 'authenticated')
      and not (
        r.rolname = 'authenticated'
        and acl.privilege_type = 'EXECUTE'
      )
    order by 1
  $$,
  'manage_ functions grant anon/authenticated nothing beyond designed execute'
);

-- 2f) 凡 SECURITY DEFINER 必须显式设置 search_path（防劫持）
select is_empty(
  $$
    select format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg(val)
        where cfg.val like 'search_path=%'
      )
    order by 1
  $$,
  'every public SECURITY DEFINER function sets search_path'
);

-- 3) public 视图均为 security_invoker（与现有迁移一致，避免绕过底表 RLS）
select is_empty(
  $$
    select c.relname::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not (
        coalesce(c.reloptions, '{}'::text[]) @> array['security_invoker=true']
      )
      and c.relname not in (select relname from permission_guard_view_invoker_exempt)
    order by 1
  $$,
  'every public view is security_invoker'
);

-- 4) 写操作对 anon 不开放（表与可写视图一并动态检查）
select is_empty(
  $$
    select format('%s.%s (%s)', n.nspname, c.relname, priv.priv)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral (
      values ('INSERT'), ('UPDATE'), ('DELETE')
    ) as priv(priv)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v')
      and c.relname not in (select relname from permission_guard_anon_write_exempt)
      and has_table_privilege('anon', c.oid, priv.priv)
    order by 1
  $$,
  'anon has no insert/update/delete on public tables or views'
);

select * from finish();
rollback;
