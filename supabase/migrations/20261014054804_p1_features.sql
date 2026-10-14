-- P1 configuration remains user-scoped, versioned and audited.
create table public.sales_stages(id text primary key,workspace_id uuid not null references public.workspaces(id),key text not null,label text not null check(length(trim(label)) between 1 and 80),position integer not null,active boolean not null default true,is_default boolean not null default false,version integer not null default 1,unique(workspace_id,key));
create table public.templates(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),name text not null check(length(trim(name)) between 1 and 100),kind text not null check(kind in ('lead_note','trip_note','itinerary')),content jsonb not null,active boolean not null default true,version integer not null default 1);
create table public.user_preferences(user_id uuid primary key references public.memberships(id),trip_view text not null default 'board' check(trip_view in ('board','calendar')));
alter table public.finance_categories add column active boolean not null default true;
alter table public.finance_categories add column version integer not null default 1;
alter table public.sales_stages enable row level security;
alter table public.templates enable row level security;
alter table public.user_preferences enable row level security;
revoke all on public.sales_stages,public.templates,public.user_preferences from public,anon,authenticated;
grant select on public.sales_stages,public.templates,public.user_preferences to authenticated;
create policy stages_read on public.sales_stages for select to authenticated using(private.allowed(workspace_id,'sales'));
create policy templates_read on public.templates for select to authenticated using(private.admin(workspace_id) or private.allowed(workspace_id,case kind when 'lead_note' then 'sales' else 'trips' end));
create policy preference_read on public.user_preferences for select to authenticated using(user_id=auth.uid() and (private.me()).id is not null);
-- Seed here also works for databases whose workspace seed follows migrations.
create function private.seed_p1(w uuid) returns void language plpgsql set search_path='' as $$begin
 insert into public.sales_stages(id,workspace_id,key,label,position,is_default) values('Drafts',w,'drafts','Drafts',0,true),('Contacted',w,'contacted','Contacted',1,false),('Prospect',w,'prospect','Prospect',2,false) on conflict do nothing;
 insert into public.templates(workspace_id,name,kind,content) select w,'Lead Notes','lead_note',to_jsonb(E'## Ringkasan kebutuhan\n\n## Preferensi\n\n## Follow-up\n\n## Risiko\n\n## Keputusan'::text) where not exists(select 1 from public.templates where workspace_id=w and kind='lead_note');
 insert into public.templates(workspace_id,name,kind,content) select w,'Internal Notes','trip_note',to_jsonb(E'## Ringkasan perjalanan\n\n## Persiapan\n\n## Catatan operasional'::text) where not exists(select 1 from public.templates where workspace_id=w and kind='trip_note');
 insert into public.templates(workspace_id,name,kind,content) select w,'Day 1','itinerary','[{"title":"","items":[]}]'::jsonb where not exists(select 1 from public.templates where workspace_id=w and kind='itinerary');
end$$;
create function private.workspace_p1() returns trigger language plpgsql set search_path='' as $$begin perform private.seed_p1(new.id);return new;end$$;
create trigger workspace_p1 after insert on public.workspaces for each row execute function private.workspace_p1();
select private.seed_p1(id) from public.workspaces;
alter function private.validate_journey(uuid,text,jsonb) rename to validate_journey_core;
create function private.validate_journey(w uuid,k text,d jsonb) returns void language plpgsql set search_path='' as $$begin
 if k='lead' and not exists(select 1 from public.sales_stages where workspace_id=w and id=d->>'stage' and (active or d->>'lifecycle'<>'active')) then raise exception 'Stage tidak aktif';end if;
 perform private.validate_journey_core(w,k,case when k='lead' then d||jsonb_build_object('stage','Drafts') else d end);
end$$;
alter function private.command(jsonb) rename to command_core;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships;d jsonb:=coalesce(c->'data','{}');a text:=c->>'action';i uuid:=(c->>'id')::uuid;v integer:=(c->>'version')::integer;r uuid;j public.journeys;t public.templates;s public.sales_stages;cat public.finance_categories;content jsonb;notes jsonb;days jsonb;day jsonb;items jsonb;item jsonb;sid text;replacement text;begin
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 if a='trip_view' then
  if not private.allowed(m.workspace_id,'trips') or d->>'view' not in ('board','calendar') then raise exception 'Akses/view tidak valid' using errcode='42501';end if;
  insert into public.user_preferences(user_id,trip_view) values(m.id,d->>'view') on conflict(user_id) do update set trip_view=excluded.trip_view;return m.id;
 elsif a in ('save_stage','retire_stage','save_category','save_template') then
  if m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
  r:=gen_random_uuid();
  if a in ('save_stage','retire_stage') then
   sid:=d->>'id'; select * into s from public.sales_stages where id=sid and workspace_id=m.workspace_id;
   if s.id is not null and s.version is distinct from v then raise exception 'Konfigurasi berubah. Reload.' using errcode='40001';end if;
   if a='retire_stage' then
    replacement:=d->>'replacement';if s.id is null or not s.active or replacement=s.id or not exists(select 1 from public.sales_stages where id=replacement and workspace_id=m.workspace_id and active) then raise exception 'Pilih replacement stage aktif';end if;
    update public.journeys set data=jsonb_set(data,'{stage}',to_jsonb(replacement)),version=version+1,updated_at=now() where workspace_id=m.workspace_id and kind='lead' and data->>'stage'=sid and data->>'lifecycle'='active';
    if s.is_default then update public.sales_stages set is_default=true,version=version+1 where id=replacement;end if;
    update public.sales_stages set active=false,is_default=false,version=version+1 where id=sid;
   else
    if s.id is null then sid:=r::text;insert into public.sales_stages(id,workspace_id,key,label,position) values(sid,m.workspace_id,sid,trim(d->>'label'),(d->>'position')::integer);
    else update public.sales_stages set label=trim(d->>'label'),position=(d->>'position')::integer,version=version+1 where id=sid;end if;
    if d->>'is_default'='true' then
     if exists(select 1 from public.sales_stages where id=sid and not active) then raise exception 'Default harus aktif';end if;
     update public.sales_stages set is_default=(id=sid),version=version+1 where workspace_id=m.workspace_id and is_default is distinct from (id=sid);
    end if;
   end if;
  elsif a='save_category' then
   sid:=d->>'id';select * into cat from public.finance_categories where id=sid;
   if cat.id is null then insert into public.finance_categories(id,name,direction) values(r::text,trim(d->>'name'),d->>'direction');
   else
    if cat.version is distinct from v then raise exception 'Kategori berubah. Reload.' using errcode='40001';end if;
    if d->>'direction' is distinct from cat.direction then raise exception 'Direction kategori tidak dapat diubah; buat kategori baru';end if;
    update public.finance_categories set name=trim(d->>'name'),active=(d->>'active')::boolean,version=version+1 where id=sid;
   end if;
   if coalesce(length(trim(d->>'name')),0) not between 1 and 100 then raise exception 'Nama kategori wajib';end if;
  else
   if i is not null then select * into t from public.templates where id=i and workspace_id=m.workspace_id;if t.id is null then raise exception 'Template tidak ditemukan';end if;if t.version is distinct from v then raise exception 'Template berubah. Reload.' using errcode='40001';end if;end if;
   content:=d->'content';
   if d->>'kind' in ('lead_note','trip_note') then if jsonb_typeof(content) is distinct from 'string' or length(content#>>'{}')>50000 then raise exception 'Markdown tidak valid';end if;
   elsif d->>'kind'='itinerary' then
    if jsonb_typeof(content) is distinct from 'array' or jsonb_array_length(content) not between 1 and 90 then raise exception 'Itinerary template tidak valid';end if;
    for day in select value from jsonb_array_elements(content) loop
     if jsonb_typeof(day->'title') is distinct from 'string' or jsonb_typeof(day->'items') is distinct from 'array' or jsonb_array_length(day->'items')>100 then raise exception 'Day tidak valid';end if;
     for item in select value from jsonb_array_elements(day->'items') loop if jsonb_typeof(item->'name') is distinct from 'string' or coalesce(length(trim(item->>'name')),0)=0 or length(item->>'name')>200 or jsonb_typeof(item->'description') is distinct from 'string' or length(item->>'description')>10000 then raise exception 'Item tidak valid';end if;end loop;
    end loop;
   else raise exception 'Kind tidak valid';end if;
   if i is null then insert into public.templates(id,workspace_id,name,kind,content) values(r,m.workspace_id,trim(d->>'name'),d->>'kind',content);
   else r:=i;update public.templates set name=trim(d->>'name'),kind=d->>'kind',content=d->'content',active=(d->>'active')::boolean,version=version+1 where id=i;end if;
  end if;
  insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,a,coalesce(sid,r::text),jsonb_build_object('configuration',true));return r;
 elsif a='apply_template' then
  select * into j from public.journeys where id=i and workspace_id=m.workspace_id;
  select * into t from public.templates where id=(d->>'template')::uuid and workspace_id=m.workspace_id and active;
  if j.id is null or t.id is null or not private.parent_allowed(i,true) or j.data->>'lifecycle'<>'active' then raise exception 'Akses ditolak' using errcode='42501';end if;
  if j.version is distinct from v then raise exception 'Data berubah. Reload / Copy Changes.' using errcode='40001';end if;
  if d->>'mode' not in ('append','replace') then raise exception 'Pilih Append atau Replace';end if;
  if t.kind='itinerary' then
   days:='[]';for day in select value from jsonb_array_elements(t.content) loop
    items:='[]';for item in select value from jsonb_array_elements(day->'items') loop items:=items||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name',item->>'name','description',item->>'description'));end loop;
    days:=days||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title',day->>'title','items',items));end loop;
   content:=jsonb_build_object('days',case when d->>'mode'='append' then (j.data->'days')||days else days end);
  else
   if t.kind is distinct from (case j.kind when 'lead' then 'lead_note' else 'trip_note' end) then raise exception 'Template kind tidak cocok';end if;
   notes:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title',t.name,'body',t.content#>>'{}'));
   content:=jsonb_build_object('notes',case when d->>'mode'='append' then (j.data->'notes')||notes else notes end);
  end if;
  perform private.command_core(jsonb_build_object('action','content','id',i,'version',v,'data',content));
  insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,a,i::text,jsonb_build_object('template',t.id,'mode',d->>'mode'));return i;
 else
  if a in ('create_transaction','edit_transaction') and exists(select 1 from public.finance_categories where id=d->>'category' and not active) and (a='create_transaction' or not exists(select 1 from public.transactions where id=i and category_id=d->>'category')) then raise exception 'Kategori tidak aktif';end if;
  if a='create_journey' and d->>'kind'='lead' and coalesce(d->>'stage','')='' then select id into sid from public.sales_stages where workspace_id=m.workspace_id and active and is_default; c:=jsonb_set(c,'{data,stage}',to_jsonb(sid));end if;
  if a='restore' then select * into j from public.journeys where id=i and workspace_id=m.workspace_id;if j.kind='lead' and not exists(select 1 from public.sales_stages where id=j.data->>'stage' and active) then select id into sid from public.sales_stages where workspace_id=m.workspace_id and active and is_default;update public.journeys set data=jsonb_set(data,'{stage}',to_jsonb(sid)) where id=i;end if;end if;
  return private.command_core(c);
 end if;
end$$;
revoke all on function private.command(jsonb),private.command_core(jsonb),private.seed_p1(uuid),private.workspace_p1(),private.validate_journey_core(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.command(jsonb) to authenticated;
-- Recreate wrapper because SQL function bodies may bind the renamed function OID.
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;

alter function private.snapshot(text,jsonb,uuid) rename to snapshot_core;
create function private.snapshot(view_name text,filters jsonb,record_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.memberships;s jsonb;st jsonb;pref text;begin
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 if view_name in ('configuration','audit') and m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
 s:=private.snapshot_core(case when view_name in ('configuration','audit') then 'people' else view_name end,filters,record_id);
 select coalesce(jsonb_agg(to_jsonb(x)-'workspace_id' order by position,id),'[]') into st from public.sales_stages x where workspace_id=m.workspace_id and (private.allowed(m.workspace_id,'sales') or m.role='admin');
 s:=s||jsonb_build_object('salesStages',st,'tripView',coalesce((select trip_view from public.user_preferences where user_id=m.id),'board'),'templates',(select coalesce(jsonb_agg(to_jsonb(t)-'workspace_id' order by name),'[]') from public.templates t where workspace_id=m.workspace_id and (m.role='admin' or private.allowed(m.workspace_id,case kind when 'lead_note' then 'sales' else 'trips' end))));
 if private.allowed(m.workspace_id,'finance') then s:=s||jsonb_build_object('categories',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.finance_categories c));end if;
 if view_name='home' and (coalesce(filters->>'from','')<>'' or coalesce(filters->>'to','')<>'' or coalesce(filters->>'context','')<>'') then
  -- Filter all authorized tasks before applying each column's limit.
  with filtered as (select t.*,row_number() over(partition by t.data->>'status' order by case when t.data->>'status'='Done' then t.data->>'completed_at' end desc,coalesce(nullif(t.data->>'due',''),'9999'),t.id) n from public.tasks t where t.workspace_id=m.workspace_id and t.data->>'cancelled_at' is null and ((m.role='admin' and filters->>'assignee'='all') or t.assignee::text=coalesce(nullif(filters->>'assignee',''),m.id::text)) and (t.parent is null or private.parent_allowed(t.parent)) and (coalesce(filters->>'from','')='' or t.data->>'due'>=filters->>'from') and (coalesce(filters->>'to','')='' or t.data->>'due'<=filters->>'to') and (coalesce(filters->>'context','')='' or t.data->>'context'=filters->>'context'))
  select s||jsonb_build_object('tasks',(select coalesce(jsonb_agg(private.row_json(data,id,version,created_at,updated_at) order by n),'[]') from filtered where n<=50+greatest(0,coalesce((filters->>'page')::integer,0))*50),'taskCounts',(select coalesce(jsonb_object_agg(status,n),'{}') from (select data->>'status' status,count(*) n from filtered group by data->>'status') ct)) into s;
  s:=s||jsonb_build_object('journeys',(select coalesce(jsonb_agg(private.row_json(jsonb_build_object('kind',j.kind,'name',j.data->>'name','client',j.data->>'client','lifecycle',j.data->>'lifecycle'),j.id,j.version,j.created_at,j.updated_at)),'[]') from public.journeys j where private.parent_allowed(j.id) and exists(select 1 from jsonb_array_elements(s->'tasks') t where t->>'parent'=j.id::text)));
 end if;
 if view_name='audit' then
  s:=s||jsonb_build_object('audit',(select coalesce(jsonb_agg(to_jsonb(a)-'workspace_id' order by at desc,id),'[]') from (select * from private.audit_events where workspace_id=m.workspace_id and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower(action||' '||entity))>0) order by at desc,id limit 50 offset greatest(0,coalesce((filters->>'page')::integer,0))*50) a),'count',(select count(*) from private.audit_events where workspace_id=m.workspace_id and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower(action||' '||entity))>0)));
 end if;return s;
end$$;
revoke all on function private.snapshot(text,jsonb,uuid),private.snapshot_core(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.snapshot(text,jsonb,uuid) to authenticated;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
notify pgrst,'reload schema';

create function private.insights(mode_name text,filters jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.memberships;tz text;today date;anchor date;start_current date;end_current date;start_previous date;end_previous date;months integer;result jsonb;begin
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 select timezone into tz from public.workspaces where id=m.workspace_id;today:=(now() at time zone tz)::date;
 if mode_name='sales' then
  if not private.allowed(m.workspace_id,'sales') then raise exception 'Akses ditolak' using errcode='42501';end if;
  select jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object('id',j.id,'name',coalesce(nullif(j.data->>'name',''),j.data->>'client'),'stage',j.data->>'stage','lifecycle',j.data->>'lifecycle','pic',j.data->>'pic','age',today-(j.created_at at time zone tz)::date,'pending',(select count(*) from public.tasks t where t.parent=j.id and t.data->>'status'<>'Done' and t.data->>'cancelled_at' is null),'overdue',(select count(*) from public.tasks t where t.parent=j.id and t.data->>'status'<>'Done' and t.data->>'cancelled_at' is null and nullif(t.data->>'due','')::date<today)) order by j.created_at desc),'[]')) into result from public.journeys j where j.workspace_id=m.workspace_id and kind='lead' and (coalesce(filters->>'pic','')='' or j.data->>'pic'=filters->>'pic') and (coalesce(filters->>'from','')='' or (j.created_at at time zone tz)::date>=(filters->>'from')::date) and (coalesce(filters->>'to','')='' or (j.created_at at time zone tz)::date<=(filters->>'to')::date);
 elsif mode_name='calendar' then
  if not private.allowed(m.workspace_id,'trips') then raise exception 'Akses ditolak' using errcode='42501';end if;
  if coalesce(filters->>'from','')='' or coalesce(filters->>'to','')='' or (filters->>'to')::date-(filters->>'from')::date>92 then raise exception 'Calendar range maksimum 92 hari';end if;
  select jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object('id',j.id,'name',j.data->>'name','stage',j.data->>'stage','start',j.data->>'start','end',j.data->>'end') order by j.data->>'start'),'[]')) into result from public.journeys j where j.workspace_id=m.workspace_id and kind='trip' and j.data->>'lifecycle'='active' and (j.data->>'start')::date<=(filters->>'to')::date and (j.data->>'end')::date>=(filters->>'from')::date and (coalesce(filters->>'pic','')='' or j.data->>'pic'=filters->>'pic') and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower((j.data->>'name')||' '||(j.data->>'client')))>0);
 elsif mode_name='comparison' then
  if not private.allowed(m.workspace_id,'finance') then raise exception 'Akses ditolak' using errcode='42501';end if;
  months:=case when filters->>'period'='quarter' then 3 else 1 end;
  anchor:=coalesce(nullif(filters->>'anchor','')::date,(date_trunc(case when months=3 then 'quarter' else 'month' end,today::timestamp)-make_interval(months=>months))::date);
  start_current:=date_trunc(case when months=3 then 'quarter' else 'month' end,anchor::timestamp)::date;
  if start_current>today then raise exception 'Periode masa depan tidak tersedia';end if;
  end_current:=least(today,(start_current+make_interval(months=>months)-interval '1 day')::date);
  start_previous:=(start_current-make_interval(months=>months))::date;end_previous:=start_current-1;
  select jsonb_build_object('current',private.cash_totals(coalesce(jsonb_agg(t.data) filter(where t.transaction_date between start_current and end_current),'[]')),'previous',private.cash_totals(coalesce(jsonb_agg(t.data) filter(where t.transaction_date between start_previous and end_previous),'[]')),'currentCount',count(*) filter(where t.transaction_date between start_current and end_current),'previousCount',count(*) filter(where t.transaction_date between start_previous and end_previous),'from',start_current,'to',end_current,'previousFrom',start_previous,'previousTo',end_previous,'partial',end_current<(start_current+make_interval(months=>months)-interval '1 day')::date) into result from public.transactions t where t.workspace_id=m.workspace_id and t.data->>'status'='posted' and t.transaction_date between start_previous and end_current;
 else raise exception 'View tidak valid';end if;return result;
end$$;
create function public.app_insights(mode_name text,filters jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.insights(mode_name,filters)$$;
revoke all on function private.insights(text,jsonb),public.app_insights(text,jsonb) from public,anon,authenticated;
grant execute on function private.insights(text,jsonb),public.app_insights(text,jsonb) to authenticated;
revoke all on function private.validate_journey(uuid,text,jsonb) from public,anon,authenticated;

