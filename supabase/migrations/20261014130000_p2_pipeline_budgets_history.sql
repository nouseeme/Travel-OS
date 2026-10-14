create table public.trip_stages (
 workspace_id uuid not null references public.workspaces(id),id text not null,label text not null check(length(trim(label)) between 1 and 80),
 position integer not null check(position>=0),semantic text not null check(semantic in ('open','completed','cancelled')),
 active boolean not null default true,is_default boolean not null default false,version integer not null default 1,
 primary key(workspace_id,id),check(not is_default or (active and semantic='open'))
);
create unique index trip_stage_default on public.trip_stages(workspace_id) where is_default;
create unique index trip_stage_label on public.trip_stages(workspace_id,lower(trim(label))) where active;
alter table public.trip_stages enable row level security;
revoke all on public.trip_stages from public,anon,authenticated;
grant select on public.trip_stages to authenticated;
create policy trip_stages_read on public.trip_stages for select to authenticated using(private.admin(workspace_id) or private.allowed(workspace_id,'trips'));
create function private.seed_trip_stages(w uuid) returns void language sql set search_path='' as $$
 insert into public.trip_stages(workspace_id,id,label,position,semantic,is_default) values
 (w,'Planned','Planned',0,'open',true),(w,'In Progress','In Progress',1,'open',false),(w,'Completed','Completed',2,'completed',false),(w,'Cancelled','Cancelled',3,'cancelled',false) on conflict do nothing;
$$;
do $$declare w uuid;begin for w in select id from public.workspaces loop perform private.seed_trip_stages(w);end loop;end$$;
create function private.workspace_trip_stages() returns trigger language plpgsql set search_path='' as $$begin perform private.seed_trip_stages(new.id);return new;end$$;
create trigger workspace_trip_stages after insert on public.workspaces for each row execute function private.workspace_trip_stages();
revoke all on function private.seed_trip_stages(uuid),private.workspace_trip_stages() from public,anon,authenticated;

create table public.trip_budgets (
 workspace_id uuid not null,trip_id uuid not null,category_id text not null,amount_idr bigint not null check(amount_idr>=0),
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(workspace_id,trip_id,category_id),
 foreign key(trip_id,workspace_id) references public.journeys(id,workspace_id),
 foreign key(category_id) references public.finance_categories(id)
);
alter table public.trip_budgets enable row level security;
revoke all on public.trip_budgets from public,anon,authenticated;
grant select on public.trip_budgets to authenticated;
create policy trip_budgets_read on public.trip_budgets for select to authenticated using(private.allowed(workspace_id,'finance'));
create index transactions_budget_actual on public.transactions(workspace_id,trip,category_id) where data->>'status'='posted';
create function private.check_budget() returns trigger language plpgsql set search_path='' as $$begin
 if not exists(select 1 from public.journeys where id=new.trip_id and workspace_id=new.workspace_id and kind='trip') then raise exception 'Budget harus untuk Trip';end if;return new;
end$$;
create trigger budget_trip before insert or update on public.trip_budgets for each row execute function private.check_budget();
revoke all on function private.check_budget() from public,anon,authenticated;

alter function private.validate_journey(uuid,text,jsonb) rename to validate_journey_p1;
create function private.validate_journey(w uuid,k text,d jsonb) returns void language plpgsql set search_path='' as $$
declare st public.trip_stages;
begin
 if k='trip' then
  select * into st from public.trip_stages where workspace_id=w and id=d->>'stage';
  if st.id is null or (not st.active and d->>'lifecycle'='active') then raise exception 'Stage Trip tidak aktif';end if;
  perform private.validate_journey_p1(w,k,d||jsonb_build_object('stage',case st.semantic when 'completed' then 'Completed' when 'cancelled' then 'Cancelled' else 'Planned' end));
 else perform private.validate_journey_p1(w,k,d);end if;
end$$;
revoke all on function private.validate_journey(uuid,text,jsonb),private.validate_journey_p1(uuid,text,jsonb) from public,anon,authenticated;
-- Conversion remains one atomic operation, now choosing the configured default.
do $$declare original text;definition text;begin
 original:=pg_get_functiondef('private.command_core(jsonb)'::regprocedure);
 definition:=replace(original,'''stage'',''Planned'',''source_lead''','''stage'',(select id from public.trip_stages where workspace_id=m.workspace_id and is_default),''source_lead''');
 if definition=original then raise exception 'Trip conversion stage anchor missing';end if;execute definition;
end$$;

alter function private.command(jsonb) rename to command_p1;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare m public.memberships;d jsonb:=coalesce(c->'data','{}');a text:=c->>'action';st public.trip_stages;replacement public.trip_stages;j public.journeys;cat public.finance_categories;b public.trip_budgets;i uuid;r uuid;sid text;before_data jsonb;after_data jsonb;amount bigint;moved integer;
begin
 if a not in ('save_trip_stage','retire_trip_stage','save_budget') then
  m:=private.me();
  if a='create_journey' and d->>'kind'='trip' and coalesce(d->>'stage','')='' then
   c:=jsonb_set(c,'{data,stage}',to_jsonb((select id from public.trip_stages where workspace_id=m.workspace_id and is_default)));
  end if;
  if a in ('stage','update_journey') then
   select jsonb_build_object('name',data->>'name','client',data->>'client','stage',data->>'stage','pic',data->>'pic','start',data->>'start','end',data->>'end','guests',data->'guests') into before_data from public.journeys where id=(c->>'id')::uuid and workspace_id=m.workspace_id;
  end if;
  r:=private.command_p1(c);
  if a in ('stage','update_journey') then
   select jsonb_build_object('name',data->>'name','client',data->>'client','stage',data->>'stage','pic',data->>'pic','start',data->>'start','end',data->>'end','guests',data->'guests') into after_data from public.journeys where id=r and workspace_id=m.workspace_id;
   if before_data is distinct from after_data then insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'journey_changes',r::text,jsonb_build_object('source_action',a,'before',before_data,'after',after_data));end if;
  end if;return r;
 end if;
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 /* P2 membership recheck */
 select fresh_member.* into m from public.memberships fresh_member where fresh_member.id=auth.uid() and fresh_member.status='active';
 if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 if a='save_budget' then
  if not private.allowed(m.workspace_id,'finance',true) then raise exception 'Akses Finance ditolak' using errcode='42501';end if;
  i:=(d->>'trip')::uuid;select * into j from public.journeys where id=i and workspace_id=m.workspace_id and kind='trip' for update;
  if j.id is null then raise exception 'Trip tidak valid';end if;
  if j.data->>'lifecycle'<>'active' then raise exception 'Archive read-only';end if;
  select * into cat from public.finance_categories where id=d->>'category';
  if cat.id is null or not cat.active then raise exception 'Kategori tidak aktif';end if;
  if coalesce(d->>'amount','') !~ '^[0-9]{1,19}$' or (d->>'amount')::numeric>9223372036854775807 then raise exception 'Budget harus rupiah utuh non-negatif';end if;amount:=(d->>'amount')::bigint;
  select * into b from public.trip_budgets where workspace_id=m.workspace_id and trip_id=i and category_id=cat.id for update;
  if (b.trip_id is null and c->>'version' is not null) or (b.trip_id is not null and b.version is distinct from (c->>'version')::integer) then raise exception 'Budget berubah. Reload.' using errcode='40001';end if;
  before_data:=jsonb_build_object('amount',b.amount_idr::text,'category',cat.id,'direction',cat.direction);
  insert into public.trip_budgets(workspace_id,trip_id,category_id,amount_idr) values(m.workspace_id,i,cat.id,amount) on conflict(workspace_id,trip_id,category_id) do update set amount_idr=excluded.amount_idr,version=public.trip_budgets.version+1,updated_at=now();
  after_data:=jsonb_build_object('amount',amount::text,'category',cat.id,'direction',cat.direction);r:=i;
 else
  if m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
  sid:=coalesce(nullif(d->>'id',''),gen_random_uuid()::text);select * into st from public.trip_stages where workspace_id=m.workspace_id and id=sid for update;
  if (st.id is null and c->>'version' is not null) or (st.id is not null and st.version is distinct from (c->>'version')::integer) then raise exception 'Pipeline berubah. Reload.' using errcode='40001';end if;
  before_data:=case when st.id is null then '{}'::jsonb else to_jsonb(st)-'workspace_id' end;
  if a='retire_trip_stage' then
   select * into replacement from public.trip_stages where workspace_id=m.workspace_id and id=d->>'replacement' and active for update;
   if st.id is null or not st.active or replacement.id is null or replacement.id=st.id or replacement.semantic<>st.semantic then raise exception 'Pilih replacement aktif dengan jenis yang sama';end if;
   update public.journeys set data=jsonb_set(data,'{stage}',to_jsonb(replacement.id)),version=version+1,updated_at=now() where workspace_id=m.workspace_id and kind='trip' and data->>'stage'=st.id and data->>'lifecycle'='active';get diagnostics moved=row_count;
   update public.trip_stages set active=false,is_default=false,version=version+1 where workspace_id=m.workspace_id and id=st.id;
   if st.is_default then update public.trip_stages set is_default=true,version=version+1 where workspace_id=m.workspace_id and id=replacement.id;end if;
  else
   if st.id is not null and not st.active then raise exception 'Stage retired tidak dapat diubah';end if;
   if coalesce((d->>'is_default')::boolean,false) then
    if coalesce(st.semantic,d->>'semantic','open')<>'open' then raise exception 'Default harus stage open';end if;
    update public.trip_stages set is_default=false,version=version+1 where workspace_id=m.workspace_id and is_default and id<>sid;
   end if;
   if st.id is not null then
    update public.trip_stages set label=trim(d->>'label'),position=(d->>'position')::integer,is_default=coalesce((d->>'is_default')::boolean,false),version=version+1 where workspace_id=m.workspace_id and id=sid;
   else insert into public.trip_stages(workspace_id,id,label,position,semantic,is_default) values(m.workspace_id,sid,trim(d->>'label'),(d->>'position')::integer,coalesce(d->>'semantic','open'),coalesce((d->>'is_default')::boolean,false));end if;
  end if;
  if not exists(select 1 from public.trip_stages where workspace_id=m.workspace_id and is_default) then raise exception 'Minimal satu default open stage wajib';end if;
  select to_jsonb(x)-'workspace_id' into after_data from public.trip_stages x where workspace_id=m.workspace_id and id=sid;r:=gen_random_uuid();
 end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,a,case when a='save_budget' then i::text else sid end,jsonb_build_object('before',before_data,'after',after_data,'replacement',replacement.id,'moved',moved));return r;
end$$;
revoke all on function private.command(jsonb),private.command_p1(jsonb) from public,anon,authenticated;
grant execute on function private.command(jsonb) to authenticated;

create function private.budget_rows(w uuid,trip uuid default null) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('trip',j.id,'name',j.data->>'name','lifecycle',j.data->>'lifecycle','category',cat.id,'label',cat.name,'direction',cat.direction,'active',cat.active,'budget',b.amount_idr::text,'version',b.version,'actual',(select coalesce(sum(t.amount_idr),0)::text from public.transactions t where t.workspace_id=w and t.trip=j.id and t.category_id=cat.id and t.data->>'status'='posted')) order by j.data->>'name',cat.direction,cat.name),'[]') from public.journeys j cross join public.finance_categories cat left join public.trip_budgets b on b.workspace_id=w and b.trip_id=j.id and b.category_id=cat.id where j.workspace_id=w and j.kind='trip' and (trip is null or j.id=trip) and (cat.active or b.trip_id is not null or exists(select 1 from public.transactions t where t.workspace_id=w and t.trip=j.id and t.category_id=cat.id and t.data->>'status'='posted'));
$$;
revoke all on function private.budget_rows(uuid,uuid) from public,anon,authenticated;
alter function private.snapshot(text,jsonb,uuid) rename to snapshot_p1;
create function private.snapshot(view_name text,filters jsonb,record_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare s jsonb;m public.memberships;tz text;begin
 s:=private.snapshot_p1(view_name,filters,record_id);m:=private.me();tz:=private.ui_timezone(filters->>'timezone');
 if private.allowed(m.workspace_id,'trips') or m.role='admin' then s:=s||jsonb_build_object('tripStages',(select coalesce(jsonb_agg(to_jsonb(st)-'workspace_id' order by position,id),'[]') from public.trip_stages st where workspace_id=m.workspace_id));end if;
 if private.allowed(m.workspace_id,'finance') and (view_name='finance' or (view_name='trips' and record_id is not null)) then s:=s||jsonb_build_object('budgets',case when view_name='trips' then private.budget_rows(m.workspace_id,record_id) when coalesce(filters->>'budget_trip','')<>'' then private.budget_rows(m.workspace_id,(filters->>'budget_trip')::uuid) else '[]'::jsonb end);end if;
 if view_name='audit' then
  with events as (select a.* from private.audit_events a where workspace_id=m.workspace_id and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower(action||' '||entity))>0) and (coalesce(filters->>'actor','')='' or actor::text=filters->>'actor') and (coalesce(filters->>'action','')='' or action=filters->>'action') and (coalesce(filters->>'from','')='' or at>=((filters->>'from')::date::timestamp at time zone tz)) and (coalesce(filters->>'to','')='' or at<(((filters->>'to')::date+1)::timestamp at time zone tz)))
  select s||jsonb_build_object('audit',(select coalesce(jsonb_agg(to_jsonb(e)-'workspace_id' order by at desc,id),'[]') from (select * from events order by at desc,id limit 50 offset greatest(0,coalesce((filters->>'page')::integer,0))*50) e),'count',(select count(*) from events)) into s;
 end if;return s;
end$$;
revoke all on function private.snapshot(text,jsonb,uuid),private.snapshot_p1(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.snapshot(text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;


