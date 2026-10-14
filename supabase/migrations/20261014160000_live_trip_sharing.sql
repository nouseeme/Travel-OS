-- Live Trip bearer links. Old snapshots and Docs links retain their existing contracts.
alter table public.tasks alter column assignee drop not null;
alter table public.tasks add constraint public_task_assignment check
 ((assignee is null and data->>'assignee'='public' and data->>'context'='trip') or
  (assignee is not null and data->>'assignee'=assignee::text));
create or replace function private.check_task() returns trigger language plpgsql set search_path='' as $$declare k text;begin
 if new.parent is not null then select kind into k from public.journeys where id=new.parent and workspace_id=new.workspace_id;if k is distinct from new.data->>'context' then raise exception 'Task context tidak sesuai parent';end if;end if;
 if new.assignee is null then
  if new.parent is null or k is distinct from 'trip' or new.data->>'assignee' is distinct from 'public' then raise exception 'Public task hanya untuk Trip';end if;
 elsif (tg_op='INSERT' or new.assignee is distinct from old.assignee or new.parent is distinct from old.parent) and not private.eligible(new.workspace_id,new.assignee,case new.data->>'context' when 'lead' then 'sales' when 'trip' then 'trips' else null end) then raise exception 'Task assignee tidak eligible';end if;
 perform private.assert_date(new.data->>'due');return new;
end$$;

create table private.trip_access_links (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,trip_id uuid not null,
 token_hash text not null unique,permissions jsonb not null,expires_at timestamptz not null,
 revoked_at timestamptz,created_by uuid not null,version integer not null default 1,
 foreign key(trip_id,workspace_id) references public.journeys(id,workspace_id));
create index trip_access_parent on private.trip_access_links(trip_id,workspace_id);
create table private.trip_submissions (
 id uuid primary key default gen_random_uuid(),link_id uuid not null references private.trip_access_links(id),
 workspace_id uuid not null,trip_id uuid not null,data jsonb not null,idempotency_key uuid not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid,review_reason text not null default '',transaction_id uuid,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(link_id,idempotency_key),foreign key(trip_id,workspace_id) references public.journeys(id,workspace_id));
create index trip_submission_parent on private.trip_submissions(workspace_id,trip_id,status);
alter table private.trip_access_links enable row level security;
alter table private.trip_submissions enable row level security;
revoke all on private.trip_access_links,private.trip_submissions from public,anon,authenticated;

create function private.trip_permissions(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$declare k text;result jsonb:='{}';begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'Izin tab tidak valid';end if;
 if exists(select 1 from jsonb_object_keys(p) x where x not in ('overview','notes','itinerary','contacts','tasks','finance')) then raise exception 'Tab tidak valid';end if;
 foreach k in array array['overview','notes','itinerary','contacts','tasks','finance'] loop
  if coalesce(p->>k,'none') not in ('none','view','edit') then raise exception 'Izin tab tidak valid';end if;
  result:=result||jsonb_build_object(k,coalesce(p->>k,'none'));
 end loop;
 if not exists(select 1 from jsonb_each_text(result) x where x.value<>'none') then raise exception 'Pilih minimal satu tab';end if;
 return result;
end$$;
create function private.trip_share_manage(a text,trip uuid,link uuid,v integer,p jsonb,token text,days integer) returns jsonb language plpgsql security definer set search_path='' as $$declare m public.memberships;j public.journeys;l private.trip_access_links;begin
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'trips',true) then raise exception 'Akses Trips edit wajib' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 if not private.allowed(m.workspace_id,'trips',true) then raise exception 'Akses ditolak' using errcode='42501';end if;
 select * into j from public.journeys where id=trip and workspace_id=m.workspace_id and kind='trip';if j.id is null then raise exception 'Trip tidak ditemukan';end if;
 if a='list' then return jsonb_build_object('enabled',true,'links',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'permissions',x.permissions,'version',x.version,'expires_at',x.expires_at,'revoked_at',x.revoked_at) order by x.expires_at desc),'[]') from private.trip_access_links x where x.trip_id=j.id));end if;
 if a not in ('create','publish','regenerate','revoke') then raise exception 'Action tidak valid';end if;
 if a<>'revoke' and j.data->>'lifecycle'<>'active' then raise exception 'Trip read-only';end if;
 if link is not null then select * into l from private.trip_access_links where id=link and trip_id=j.id for update;if l.id is null then raise exception 'Link tidak ditemukan';end if;end if;
 if a in ('publish','regenerate','revoke') and (l.id is null or l.version is distinct from v) then raise exception 'Link berubah; refresh daftar link' using errcode='40001';end if;
 if a<>'revoke' then p:=private.trip_permissions(p);if p->>'finance'<>'none' and not private.allowed(m.workspace_id,'finance',true) then raise exception 'Akses Finance edit wajib untuk membagikan Finance' using errcode='42501';end if;end if;
 if a in ('create','regenerate') then
  if token is null or token !~ '^[a-f0-9]{64}$' or days is null or days not between 1 and 30 then raise exception 'Token / expiry tidak valid';end if;
  if a='regenerate' then update private.trip_access_links set revoked_at=now(),version=version+1 where id=l.id;end if;
  insert into private.trip_access_links(workspace_id,trip_id,token_hash,permissions,expires_at,created_by) values(m.workspace_id,j.id,encode(sha256(convert_to(token,'UTF8')),'hex'),p,now()+make_interval(days=>days),m.id) returning * into l;
 elsif a='revoke' then update private.trip_access_links set revoked_at=now(),version=version+1 where id=l.id;
 else
  if l.revoked_at is not null or l.expires_at<=now() then raise exception 'Link unavailable';end if;
  update private.trip_access_links set permissions=p,version=version+1 where id=l.id;
 end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'trip_share_'||a,j.id::text,jsonb_build_object('link',l.id,'permissions',case when a='revoke' then l.permissions else p end));
 return jsonb_build_object('id',l.id);
end$$;

-- Verify bearer capability for every read/write, and lock it against revoke/edit races.
create function private.trip_access(token text) returns private.trip_access_links language plpgsql set search_path='' as $$declare l private.trip_access_links;hits integer;begin
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Link tidak tersedia' using errcode='42501';end if;
 insert into private.share_rate(bucket,window_start,hits) values('trip-live',now(),1) on conflict(bucket) do update set hits=case when private.share_rate.window_start<now()-interval '1 minute' then 1 else private.share_rate.hits+1 end,window_start=case when private.share_rate.window_start<now()-interval '1 minute' then now() else private.share_rate.window_start end returning private.share_rate.hits into hits;
 if hits>300 then raise exception 'Terlalu banyak request. Coba kembali sebentar lagi.' using errcode='P0001';end if;
 select * into l from private.trip_access_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and revoked_at is null and expires_at>now() for share;
 if l.id is null then raise exception 'Link tidak tersedia' using errcode='42501';end if;
 return l;
end$$;
create function private.trip_public_read(token text) returns jsonb language plpgsql security definer set search_path='' as $$declare l private.trip_access_links;j public.journeys;d jsonb;begin
 l:=private.trip_access(token);select * into j from public.journeys where id=l.trip_id and workspace_id=l.workspace_id and kind='trip';if j.id is null then raise exception 'Link tidak tersedia' using errcode='42501';end if;
 d:=jsonb_build_object('kind','trip','name',j.data->>'name','client','','lifecycle',j.data->>'lifecycle','trip_type',j.data->>'trip_type','stage',j.data->>'stage','notes','[]'::jsonb,'contacts','[]'::jsonb,'days','[]'::jsonb,'people','[]'::jsonb,'pic','','quote','','start','','end','','guests',null,'source_lead',null,'converted_trip',null);
 if l.permissions->>'overview'<>'none' then d:=d||jsonb_build_object('start',j.data->>'start','end',j.data->>'end','guests',j.data->'guests');end if;
 if l.permissions->>'notes'<>'none' then d:=d||jsonb_build_object('notes',j.data->'notes');end if;
 if l.permissions->>'itinerary'<>'none' then d:=d||jsonb_build_object('days',j.data->'days');end if;
 if l.permissions->>'contacts'<>'none' then d:=d||jsonb_build_object('contacts',(select coalesce(jsonb_agg(jsonb_build_object('id',c->>'id','name',c->>'name','phone',c->>'phone','email',c->>'email','note',c->>'note','role','','organization','')),'[]') from jsonb_array_elements(j.data->'contacts') c));end if;
 return jsonb_build_object('permissions',l.permissions,'journey',private.row_json(d,j.id,j.version,j.created_at,j.updated_at),
 'tasks',case when l.permissions->>'tasks'='none' then '[]'::jsonb else (select coalesce(jsonb_agg(private.row_json(t.data-'created_by',t.id,t.version,t.created_at,t.updated_at) order by t.created_at),'[]') from public.tasks t where t.parent=j.id and t.workspace_id=l.workspace_id and t.assignee is null and t.data->>'cancelled_at' is null) end,
 'categories',case when l.permissions->>'finance'='none' then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'direction',c.direction,'active',c.active)),'[]') from public.finance_categories c where c.active) end,
 'submissions',case when l.permissions->>'finance'='none' then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'data',x.data,'status',x.status,'review_reason',x.review_reason,'version',x.version,'created_at',x.created_at) order by x.created_at desc),'[]') from private.trip_submissions x where x.link_id=l.id) end);
end$$;

create function private.trip_public_command(token text,c jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare l private.trip_access_links;j public.journeys;t public.tasks;x private.trip_submissions;a text:=c->>'action';d jsonb:=coalesce(c->'data','{}');tab text;nd jsonb;r uuid;v integer:=(c->>'version')::integer;begin
 l:=private.trip_access(token);select * into j from public.journeys where id=l.trip_id and workspace_id=l.workspace_id for update;
 if j.data->>'lifecycle' is distinct from 'active' then raise exception 'Trip read-only' using errcode='42501';end if;
 tab:=case when a='content' then case when d ? 'notes' then 'notes' when d ? 'days' then 'itinerary' when d ? 'contacts' then 'contacts' end when a='update_journey' then 'overview' when a in ('create_task','update_task','cancel_task','task_status') then 'tasks' when a='submit_transaction' then 'finance' end;
 if tab is null or l.permissions->>tab is distinct from 'edit' then raise exception 'Tab read-only / akses ditolak' using errcode='42501';end if;
 if jsonb_typeof(d) is distinct from 'object' then raise exception 'Input tidak valid';end if;
 if a in ('create_task','update_task') and (jsonb_typeof(d->'title') is distinct from 'string' or coalesce(length(trim(d->>'title')),0) not between 1 and 200 or jsonb_typeof(d->'description') is distinct from 'string' or length(d->>'description')>5000 or jsonb_typeof(d->'due') is distinct from 'string') then raise exception 'Task tidak valid';end if;
 if a='task_status' and coalesce(d->>'status','') not in ('Assigned','Doing','Done') then raise exception 'Status task tidak valid';end if;
 if a='update_journey' and (jsonb_typeof(d->'name') is distinct from 'string' or length(trim(d->>'name')) not between 1 and 200 or jsonb_typeof(d->'trip_type') is distinct from 'string' or length(d->>'trip_type')>200 or jsonb_typeof(d->'start') is distinct from 'string' or jsonb_typeof(d->'end') is distinct from 'string' or jsonb_typeof(d->'guests') is distinct from 'number' or (d->>'guests') !~ '^[0-9]+$' or (d->>'guests')::numeric not between 1 and 100000) then raise exception 'Detail Trip tidak valid';end if;
 if a in ('content','update_journey') then
  if c->>'id' is distinct from j.id::text then raise exception 'Trip tidak sesuai' using errcode='42501';end if;
  if j.version is distinct from v then raise exception 'Data berubah. Refresh sebelum menyimpan.' using errcode='40001';end if;
  if exists(select 1 from jsonb_object_keys(d) k where (a='content' and k<>case tab when 'notes' then 'notes' when 'itinerary' then 'days' else 'contacts' end) or (a='update_journey' and k not in ('name','start','end','guests','trip_type'))) then raise exception 'Field tidak diizinkan' using errcode='42501';end if;
  if a='content' and tab='contacts' then d:=jsonb_build_object('contacts',(select coalesce(jsonb_agg(jsonb_build_object('id',z->>'id','name',z->>'name','phone',z->>'phone','email',z->>'email','note',z->>'note','role',coalesce(old->>'role',''),'organization',coalesce(old->>'organization',''))),'[]') from jsonb_array_elements(d->'contacts') z left join lateral (select q as old from jsonb_array_elements(j.data->'contacts') q where q->>'id'=z->>'id') oldrow on true));end if;
  update public.journeys set data=data||d,version=version+1,updated_at=now() where id=j.id;r:=j.id;
 elsif tab='tasks' then
  if a='create_task' then
   r:=gen_random_uuid();nd:=jsonb_build_object('title',trim(d->>'title'),'description',coalesce(d->>'description',''),'due',coalesce(d->>'due',''),'assignee','public','context','trip','parent',j.id,'status','Assigned','completed_at',null,'cancelled_at',null,'created_by','public');
   insert into public.tasks(id,workspace_id,parent,assignee,data) values(r,l.workspace_id,j.id,null,nd);
  else
   select * into t from public.tasks where id=(c->>'id')::uuid and parent=j.id and workspace_id=l.workspace_id and assignee is null for update;
   if t.id is null or t.data->>'cancelled_at' is not null then raise exception 'Task tidak tersedia' using errcode='42501';end if;
   if t.version is distinct from v then raise exception 'Task berubah. Refresh.' using errcode='40001';end if;
   nd:=t.data;
   if a='task_status' then nd:=nd||jsonb_build_object('status',d->>'status','completed_at',case when d->>'status'='Done' then to_jsonb(now()) else 'null'::jsonb end);
   elsif a='cancel_task' then nd:=nd||jsonb_build_object('cancelled_at',now());
   else nd:=nd||jsonb_build_object('title',trim(d->>'title'),'description',coalesce(d->>'description',''),'due',coalesce(d->>'due',''));end if;
   update public.tasks set data=nd,version=version+1,updated_at=now() where id=t.id;r:=t.id;
  end if;
 else
  perform private.assert_money(d->>'amount');perform private.assert_date(d->>'date',true);
  if (d->>'date')::date>(now() at time zone private.ui_timezone(c->>'timezone'))::date or coalesce(length(trim(d->>'title')),0) not between 1 and 200 or length(coalesce(d->>'description',''))>5000 then raise exception 'Transaksi tidak valid';end if;
  if not exists(select 1 from public.finance_categories where id=d->>'category' and direction=d->>'direction' and active) then raise exception 'Kategori tidak valid';end if;
  nd:=jsonb_build_object('title',trim(d->>'title'),'date',d->>'date','direction',d->>'direction','category',d->>'category','amount',private.money_text((d->>'amount')::numeric),'description',coalesce(d->>'description',''));
  select * into x from private.trip_submissions where link_id=l.id and idempotency_key=(d->>'idempotency_key')::uuid;
  if x.id is not null then if x.data is distinct from nd then raise exception 'Pengajuan sudah tersimpan dengan data berbeda' using errcode='40001';end if;return x.id;end if;
  insert into private.trip_submissions(link_id,workspace_id,trip_id,data,idempotency_key) values(l.id,l.workspace_id,j.id,nd,(d->>'idempotency_key')::uuid) returning id into r;
 end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(l.workspace_id,l.created_by,'public_'||a,r::text,jsonb_build_object('origin','public','link',l.id));return r;
end$$;

-- Keep the existing member command path, intercept Public assignment and submission review.
alter function private.command(jsonb) rename to command_before_trip_access;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare m public.memberships;a text:=c->>'action';d jsonb:=coalesce(c->'data','{}');i uuid:=(c->>'id')::uuid;v integer:=(c->>'version')::integer;t public.tasks;j public.journeys;x private.trip_submissions;r uuid;nd jsonb;person uuid;begin
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 if a in ('approve_submission','reject_submission') then
  if not private.allowed(m.workspace_id,'finance',true) then raise exception 'Akses Finance edit wajib' using errcode='42501';end if;
  select * into x from private.trip_submissions where id=i and workspace_id=m.workspace_id for update;
  if x.id is null or not private.parent_allowed(x.trip_id) then raise exception 'Akses Trip ditolak' using errcode='42501';end if;
  if x.status<>'pending' or x.version is distinct from v then raise exception 'Pengajuan sudah diproses' using errcode='40001';end if;
  if a='approve_submission' then
   r:=private.command_before_trip_access(jsonb_build_object('action','create_transaction','timezone',c->>'timezone','data',x.data||jsonb_build_object('trip',x.trip_id,'idempotency_key',x.id)));
  else if coalesce(length(trim(d->>'reason')),0) not between 1 and 5000 then raise exception 'Alasan penolakan wajib';end if;r:=x.id;end if;
  update private.trip_submissions set status=case a when 'approve_submission' then 'approved' else 'rejected' end,transaction_id=case a when 'approve_submission' then r end,reviewed_by=m.id,review_reason=coalesce(d->>'reason',''),version=version+1,updated_at=now() where id=x.id;
 elsif a in ('create_task','update_task','cancel_task','task_status') then
  if a<>'create_task' then select * into t from public.tasks where id=i and workspace_id=m.workspace_id for update;end if;
  if (a in ('create_task','update_task') and d->>'assignee'='public') or (t.id is not null and t.assignee is null) then
   select * into j from public.journeys where id=case a when 'create_task' then (d->>'parent')::uuid else t.parent end and workspace_id=m.workspace_id and kind='trip' for update;
   if j.id is null or j.data->>'lifecycle'<>'active' or not private.parent_allowed(j.id,true) then raise exception 'Public task memerlukan akses Trip edit' using errcode='42501';end if;
   if a='create_task' and d->>'context' is distinct from 'trip' then raise exception 'Public task hanya untuk Trip';end if;
   if a<>'create_task' and (t.version is distinct from v or t.data->>'cancelled_at' is not null) then raise exception 'Task berubah' using errcode='40001';end if;
   if a='create_task' then
    r:=gen_random_uuid();nd:=jsonb_build_object('title',trim(d->>'title'),'description',coalesce(d->>'description',''),'due',coalesce(d->>'due',''),'assignee','public','context','trip','parent',j.id,'status','Assigned','completed_at',null,'cancelled_at',null,'created_by',m.id);
    insert into public.tasks(id,workspace_id,parent,assignee,data) values(r,m.workspace_id,j.id,null,nd);
   else
    nd:=t.data;person:=t.assignee;r:=t.id;
    if a='task_status' then nd:=nd||jsonb_build_object('status',d->>'status','completed_at',case when d->>'status'='Done' then to_jsonb(now()) else 'null'::jsonb end);
    elsif a='cancel_task' then nd:=nd||jsonb_build_object('cancelled_at',now());
    else person:=case when d->>'assignee'='public' then null else (d->>'assignee')::uuid end;nd:=nd||jsonb_build_object('title',trim(d->>'title'),'description',coalesce(d->>'description',''),'due',coalesce(d->>'due',''),'assignee',d->>'assignee');end if;
    update public.tasks set data=nd,assignee=person,version=version+1,updated_at=now() where id=t.id;
   end if;
  else return private.command_before_trip_access(c);end if;
 else return private.command_before_trip_access(c);end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,a,coalesce(i,r)::text,'{}');return r;
end$$;
alter function private.snapshot(text,jsonb,uuid) rename to snapshot_before_trip_access;
create function private.snapshot(v text,f jsonb,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare s jsonb;m public.memberships;begin
 s:=private.snapshot_before_trip_access(v,f,i);m:=private.me();
 s:=s||jsonb_build_object('reassignment',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(coalesce(s->'reassignment','[]')) x where x->>'assignee'<>'public'));
 if v in ('trips','finance') and private.allowed(m.workspace_id,'finance',true) then
  s:=s||jsonb_build_object('submissions',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'trip_id',x.trip_id,'data',x.data,'status',x.status,'version',x.version,'created_at',x.created_at) order by x.created_at),'[]') from private.trip_submissions x where x.workspace_id=m.workspace_id and x.status='pending' and (i is null or x.trip_id=i) and private.parent_allowed(x.trip_id)));
 end if;return s;
end$$;
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
create function public.app_trip_share_manage(action_name text,trip_id uuid,link_id uuid default null,expected_version integer default null,permissions jsonb default '{}',raw_token text default null,expiry_days integer default 7) returns jsonb language sql security invoker set search_path='' as $$select private.trip_share_manage(action_name,trip_id,link_id,expected_version,permissions,raw_token,expiry_days)$$;
create function public.app_trip_public_read(raw_token text) returns jsonb language sql security invoker set search_path='' as $$select private.trip_public_read(raw_token)$$;
create function public.app_trip_public_command(raw_token text,command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.trip_public_command(raw_token,command)$$;
revoke all on function private.trip_permissions(jsonb),private.trip_share_manage(text,uuid,uuid,integer,jsonb,text,integer),private.trip_access(text),private.trip_public_read(text),private.trip_public_command(text,jsonb),private.command_before_trip_access(jsonb),private.command(jsonb),private.snapshot_before_trip_access(text,jsonb,uuid),private.snapshot(text,jsonb,uuid),public.app_trip_share_manage(text,uuid,uuid,integer,jsonb,text,integer),public.app_trip_public_read(text),public.app_trip_public_command(text,jsonb) from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.command(jsonb),private.snapshot(text,jsonb,uuid),private.trip_share_manage(text,uuid,uuid,integer,jsonb,text,integer),public.app_trip_share_manage(text,uuid,uuid,integer,jsonb,text,integer) to authenticated;
grant execute on function private.trip_public_read(text),private.trip_public_command(text,jsonb),public.app_trip_public_read(text),public.app_trip_public_command(text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
