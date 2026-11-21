begin;
select plan(14);

-- 仅在回滚事务内构造样本，验证确认键含角色名、互不覆盖，保存作品不丢确认，以及删除作品/人物时级联清理。
insert into auth.users(id,email) values
  ('fd000000-0000-4000-8000-000000000001','owner@test.invalid');
insert into public.site_owner(user_id) values ('fd000000-0000-4000-8000-000000000001');

insert into public.media_items(id,type,title) values
  ('fd000000-0000-4000-8000-000000000100','movie','Confirm movie'),
  ('fd000000-0000-4000-8000-000000000101','movie','Orphan movie');
insert into public.people(id,name) values
  ('fd000000-0000-4000-8000-000000000201','Confirm Actor'),
  ('fd000000-0000-4000-8000-000000000202','Orphan Person');
insert into public.media_credits(media_item_id,person_id,role,credit_order,character_name) values
  ('fd000000-0000-4000-8000-000000000100','fd000000-0000-4000-8000-000000000201','actor',0,'警察/卧底'),
  ('fd000000-0000-4000-8000-000000000101','fd000000-0000-4000-8000-000000000202','actor',0,'临时角色/备注');

select ok(
  public.manage_name_issue_credit_item_id(
    'fd000000-0000-4000-8000-000000000100',
    'fd000000-0000-4000-8000-000000000201',
    '警察/卧底'
  ) <> public.manage_name_issue_credit_item_id(
    'fd000000-0000-4000-8000-000000000100',
    'fd000000-0000-4000-8000-000000000201',
    '英雄/反派'
  ),
  'same actor and work with different characters get distinct confirmation keys'
);

-- 当前角色「警察/卧底」出现在报告中；确认后离开；改成另一角色再确认，两行并存且互不覆盖。
select ok(
  exists(
    select 1 from public.v_report_suspicious_names
    where id = public.manage_name_issue_credit_item_id(
      'fd000000-0000-4000-8000-000000000100',
      'fd000000-0000-4000-8000-000000000201',
      '警察/卧底'
    )
  ),
  'first character role is listed before confirmation'
);

insert into public.name_issue_confirmations(item_id, confirmed_name)
values (
  public.manage_name_issue_credit_item_id(
    'fd000000-0000-4000-8000-000000000100',
    'fd000000-0000-4000-8000-000000000201',
    '警察/卧底'
  ),
  '警察/卧底'
);

select ok(
  not exists(
    select 1 from public.v_report_suspicious_names
    where id = public.manage_name_issue_credit_item_id(
      'fd000000-0000-4000-8000-000000000100',
      'fd000000-0000-4000-8000-000000000201',
      '警察/卧底'
    )
  ),
  'confirmed first character leaves the report'
);

update public.media_credits
set character_name = '英雄/反派'
where media_item_id = 'fd000000-0000-4000-8000-000000000100'
  and person_id = 'fd000000-0000-4000-8000-000000000201';

select ok(
  exists(
    select 1 from public.v_report_suspicious_names
    where id = public.manage_name_issue_credit_item_id(
      'fd000000-0000-4000-8000-000000000100',
      'fd000000-0000-4000-8000-000000000201',
      '英雄/反派'
    )
  ),
  'second character role appears independently after rename'
);

insert into public.name_issue_confirmations(item_id, confirmed_name)
values (
  public.manage_name_issue_credit_item_id(
    'fd000000-0000-4000-8000-000000000100',
    'fd000000-0000-4000-8000-000000000201',
    '英雄/反派'
  ),
  '英雄/反派'
);

select is(
  (
    select count(*)::integer from public.name_issue_confirmations
    where media_item_id = 'fd000000-0000-4000-8000-000000000100'
      and person_id = 'fd000000-0000-4000-8000-000000000201'
  ),
  2,
  'confirming the second role keeps the first confirmation row'
);

select ok(
  not exists(
    select 1 from public.v_report_suspicious_names
    where id = public.manage_name_issue_credit_item_id(
      'fd000000-0000-4000-8000-000000000100',
      'fd000000-0000-4000-8000-000000000201',
      '英雄/反派'
    )
  ),
  'confirmed second character leaves the report'
);

-- 改回第一角色：旧确认仍有效，说明未因第二次确认被覆盖。
update public.media_credits
set character_name = '警察/卧底'
where media_item_id = 'fd000000-0000-4000-8000-000000000100'
  and person_id = 'fd000000-0000-4000-8000-000000000201';

select ok(
  not exists(
    select 1 from public.v_report_suspicious_names
    where id = public.manage_name_issue_credit_item_id(
      'fd000000-0000-4000-8000-000000000100',
      'fd000000-0000-4000-8000-000000000201',
      '警察/卧底'
    )
  ),
  'first character confirmation still applies after switching back'
);

-- 同一键再次确认只覆盖该行（仍一行）。
insert into public.name_issue_confirmations(item_id, confirmed_name)
values (
  public.manage_name_issue_credit_item_id(
    'fd000000-0000-4000-8000-000000000100',
    'fd000000-0000-4000-8000-000000000201',
    '警察/卧底'
  ),
  '警察/卧底'
)
on conflict (item_id) do update set confirmed_name = excluded.confirmed_name, confirmed_at = now();

select is(
  (
    select count(*)::integer from public.name_issue_confirmations
    where item_id = public.manage_name_issue_credit_item_id(
      'fd000000-0000-4000-8000-000000000100',
      'fd000000-0000-4000-8000-000000000201',
      '警察/卧底'
    )
  ),
  1,
  're-confirming the same credit overwrites that row only'
);

-- 保存作品会删光再插入演职，确认行必须保留（因此不加 media_credits 级联 FK）。
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','fd000000-0000-4000-8000-000000000001',true); end $$;
select lives_ok(
  $$select public.admin_save_media(jsonb_build_object(
    'id','fd000000-0000-4000-8000-000000000100',
    'type','movie',
    'title','Confirm movie',
    'status','want_to_watch',
    'rating',null,
    'genres','[]'::jsonb,
    'languages','[]'::jsonb,
    'regions','[]'::jsonb,
    'directors','[]'::jsonb,
    'actors',jsonb_build_array(jsonb_build_object(
      'id','fd000000-0000-4000-8000-000000000201',
      'name','Confirm Actor',
      'character','警察/卧底'
    ))
  ))$$,
  'owner can re-save the same cast through admin_save_media'
);
reset role;

select ok(
  exists(
    select 1 from public.name_issue_confirmations
    where item_id = public.manage_name_issue_credit_item_id(
      'fd000000-0000-4000-8000-000000000100',
      'fd000000-0000-4000-8000-000000000201',
      '警察/卧底'
    )
  ),
  're-saving media keeps the character confirmation row'
);

-- 删除作品 / 人物时确认行随之清除。
insert into public.name_issue_confirmations(item_id, confirmed_name)
values (
  public.manage_name_issue_credit_item_id(
    'fd000000-0000-4000-8000-000000000101',
    'fd000000-0000-4000-8000-000000000202',
    '临时角色/备注'
  ),
  '临时角色/备注'
),
(
  public.manage_name_issue_people_item_id('fd000000-0000-4000-8000-000000000202'),
  'Orphan Person'
);

delete from public.media_items where id = 'fd000000-0000-4000-8000-000000000101';
select ok(
  not exists(
    select 1 from public.name_issue_confirmations
    where media_item_id = 'fd000000-0000-4000-8000-000000000101'
  ),
  'deleting a work removes its credit confirmation rows'
);
select ok(
  exists(
    select 1 from public.name_issue_confirmations
    where item_id = public.manage_name_issue_people_item_id('fd000000-0000-4000-8000-000000000202')
  ),
  'people confirmation survives until the person is deleted'
);

delete from public.people where id = 'fd000000-0000-4000-8000-000000000202';
select ok(
  not exists(
    select 1 from public.name_issue_confirmations
    where person_id = 'fd000000-0000-4000-8000-000000000202'
  ),
  'deleting a person removes its confirmation rows'
);

delete from public.media_items where id = 'fd000000-0000-4000-8000-000000000100';
select ok(
  not exists(
    select 1 from public.name_issue_confirmations
    where media_item_id = 'fd000000-0000-4000-8000-000000000100'
  ),
  'deleting the remaining work clears its confirmation rows'
);

select * from finish();
rollback;
