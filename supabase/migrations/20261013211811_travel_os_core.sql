-- Travel OS: one workspace, invite-only membership, private child documents.
-- No direct DML for app users. All writes enter a narrow, audited command RPC.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.workspaces (id uuid primary key, name text not null, timezone text not null default 'Asia/Jakarta');
create table public.memberships (
 id uuid primary key references auth.users(id) on delete restrict,
 workspace_id uuid not null references public.workspaces(id), name text not null,
 email text not null, role text not null check(role in ('admin','member')),
 status text not null check(status in ('active','invited','deactivated')),version integer not null default 1,
 privileges jsonb not null default '{"sales":"none","trips":"none","finance":"none"}',
 unique(workspace_id,email), unique(workspace_id,id),
 check(privileges ?& array['sales','trips','finance'] and privileges->>'sales' in ('none','view','edit') and privileges->>'trips' in ('none','view','edit') and privileges->>'finance' in ('none','view','edit'))
);
create table public.journeys (
 id uuid primary key, workspace_id uuid not null references public.workspaces(id),
 kind text not null check(kind in ('lead','trip')), data jsonb not null,
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 source_lead uuid, unique(workspace_id,id), unique(source_lead),
 foreign key(workspace_id,source_lead) references public.journeys(workspace_id,id) on delete restrict,
 check(data->>'lifecycle' in ('active','lost','converted','archived')),
 check(length(trim(data->>'client'))>0), check(jsonb_typeof(data->'notes')='array'), check(jsonb_typeof(data->'days')='array'), check(jsonb_typeof(data->'contacts')='array')
);
create table public.tasks (
 id uuid primary key, workspace_id uuid not null references public.workspaces(id),
 data jsonb not null, parent uuid, assignee uuid not null,
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,parent) references public.journeys(workspace_id,id) on delete restrict,
 foreign key(workspace_id,assignee) references public.memberships(workspace_id,id) on delete restrict,
 check(data->>'context' in ('internal','lead','trip')),
 check((data->>'context'='internal' and parent is null) or (data->>'context' in ('lead','trip') and parent is not null)),
 check(data->>'status' in ('Assigned','Doing','Done')), check(length(trim(data->>'title'))>0)
);
create table public.finance_categories (id text primary key, name text not null, direction text not null check(direction in ('in','out')), unique(id,direction));
create table public.transactions (
 id uuid primary key, workspace_id uuid not null references public.workspaces(id),
 data jsonb not null, trip uuid, amount_idr bigint not null check(amount_idr>0),
 transaction_date date not null, direction text not null check(direction in ('in','out')), category_id text not null,
 idempotency_key uuid not null, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,trip) references public.journeys(workspace_id,id) on delete restrict,
 foreign key(category_id,direction) references public.finance_categories(id,direction),
 unique(workspace_id,idempotency_key), check(data->>'status' in ('posted','void')),
 check(length(trim(data->>'description'))>0)
);
create table private.invitations (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
 email text not null,name text not null,privileges jsonb not null,status text not null check(status in ('pending','sent','failed','accepted','revoked')),
 provider_user uuid, generation uuid not null default gen_random_uuid(),created_at timestamptz not null default now(), invited_by uuid not null references public.memberships(id),version integer not null default 1,
 expires_at timestamptz not null default now()+interval '7 days'
);
create unique index one_pending_email on private.invitations(workspace_id,email) where status not in ('accepted','revoked');
create table private.audit_events (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),actor uuid not null,action text not null,entity text not null,at timestamptz not null default now(),metadata jsonb not null default '{}');
create index journey_board on public.journeys(workspace_id,kind,(data->>'lifecycle'),(data->>'stage'));
create index task_board on public.tasks(workspace_id,assignee,(data->>'status'),(data->>'due'));
create index task_parent on public.tasks(parent);
create index finance_date on public.transactions(workspace_id,transaction_date desc,created_at desc);
create index finance_trip on public.transactions(trip,transaction_date desc);
create index invite_provider on private.invitations(provider_user);

create function private.me() returns public.memberships language sql stable security definer set search_path='' as $$ select m from public.memberships m where m.id=auth.uid() and m.status='active' $$;
create function private.allowed(w uuid, module text, editing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.id=auth.uid() and m.status='active' and m.workspace_id=w and (m.role='admin' or (case when editing then m.privileges->>module='edit' else m.privileges->>module in ('view','edit') end)))
$$;
create function private.admin(w uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.memberships m where m.id=auth.uid() and m.workspace_id=w and m.status='active' and m.role='admin') $$;
create function private.parent_allowed(p uuid, editing boolean default false) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.journeys j where j.id=p and private.allowed(j.workspace_id,case j.kind when 'lead' then 'sales' else 'trips' end,editing)) $$;
create function private.eligible(w uuid,p uuid,module text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.memberships m where m.id=p and m.workspace_id=w and m.status='active' and (module is null or m.role='admin' or m.privileges->>module in ('view','edit'))) $$;
create function private.row_json(d jsonb,i uuid,v integer,c timestamptz,u timestamptz) returns jsonb language sql immutable set search_path='' as $$ select d || jsonb_build_object('id',i,'version',v,'created_at',c,'updated_at',u) $$;
create function private.person_json(m public.memberships) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',m.id,'version',m.version,'name',m.name,'email',m.email,'role',m.role,'status',m.status,'privileges',m.privileges)$$;

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.journeys enable row level security;
alter table public.tasks enable row level security;
alter table public.finance_categories enable row level security;
alter table public.transactions enable row level security;
alter table private.invitations enable row level security;
alter table private.audit_events enable row level security;
create policy workspace_read on public.workspaces for select to authenticated using(id=(private.me()).workspace_id);
create policy member_read on public.memberships for select to authenticated using(workspace_id=(private.me()).workspace_id);
create policy journey_read on public.journeys for select to authenticated using(private.allowed(workspace_id,case kind when 'lead' then 'sales' else 'trips' end));
create policy task_read on public.tasks for select to authenticated using(workspace_id=(private.me()).workspace_id and ((parent is null and (assignee=auth.uid() or private.admin(workspace_id))) or private.parent_allowed(parent)));
create policy category_read on public.finance_categories for select to authenticated using(private.allowed((private.me()).workspace_id,'finance'));
create policy finance_read on public.transactions for select to authenticated using(private.allowed(workspace_id,'finance'));
revoke all on all tables in schema public from anon,authenticated;
grant select on public.workspaces,public.memberships,public.journeys,public.tasks,public.finance_categories,public.transactions to authenticated;
grant select,insert on public.memberships to service_role;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.me(),private.allowed(uuid,text,boolean),private.admin(uuid),private.parent_allowed(uuid,boolean) to authenticated;

create function private.assert_date(d text,required boolean default false) returns void language plpgsql set search_path='' as $$ begin
 if coalesce(d,'')='' then if required then raise exception 'Tanggal wajib diisi'; else return; end if; end if;
 if d !~ '^\d{4}-\d{2}-\d{2}$' or to_char(d::date,'YYYY-MM-DD')<>d then raise exception 'Tanggal tidak valid'; end if;
end $$;
create function private.assert_money(a text,positive boolean default true) returns void language plpgsql set search_path='' as $$ begin
 if a is null or a !~ '^\d+$' or a::numeric>9223372036854775807 or (positive and a::numeric<1) then raise exception 'IDR harus digit integer positif, tanpa desimal'; end if;
end $$;
create function private.validate_journey(w uuid,k text,d jsonb) returns void language plpgsql set search_path='' as $$ declare x jsonb; y jsonb; p text; begin
 if coalesce(length(trim(d->>'client')),0)=0 or length(d->>'client')>200 then raise exception 'Nama klien wajib'; end if;
 if d->>'lifecycle'='active' and not private.eligible(w,(d->>'pic')::uuid,case k when 'lead' then 'sales' else 'trips' end) then raise exception 'PIC tidak eligible'; end if;
 perform private.assert_date(d->>'start',k='trip');perform private.assert_date(d->>'end',k='trip');
 if coalesce(d->>'start','')<>'' and coalesce(d->>'end','')<>'' and (d->>'start')::date>(d->>'end')::date then raise exception 'Tanggal mulai > selesai'; end if;
 if d->>'guests' is not null and ((d->>'guests') !~ '^\d+$' or (d->>'guests')::numeric<1 or (d->>'guests')::numeric>2147483647) then raise exception 'Guest count harus integer minimal 1'; end if;
 if coalesce(d->>'quote','')<>'' then perform private.assert_money(d->>'quote',false); end if;
 if k='trip' then
  if coalesce(length(trim(d->>'name')),0)=0 or d->>'guests' is null or d->>'stage' not in ('Planned','In Progress','Completed','Cancelled') then raise exception 'Data trip tidak valid';end if;
  if jsonb_typeof(d->'people')<>'array' or jsonb_array_length(d->'people')<1 or not (d->'people' ? (d->>'pic')) then raise exception 'PIC wajib termasuk assigned people';end if;
  for p in select jsonb_array_elements_text(d->'people') loop if d->>'lifecycle'='active' and not private.eligible(w,p::uuid,'trips') then raise exception 'Assigned person tidak eligible';end if;end loop;
 else if d->>'stage' not in ('Drafts','Contacted','Prospect') then raise exception 'Stage tidak valid';end if;end if;
 if jsonb_typeof(d->'notes')<>'array' or jsonb_array_length(d->'notes')>30 or jsonb_typeof(d->'contacts')<>'array' or jsonb_array_length(d->'contacts')>100 or jsonb_typeof(d->'days')<>'array' or jsonb_array_length(d->'days') not between 1 and 90 then raise exception 'Dokumen tidak valid';end if;
 for x in select jsonb_array_elements(d->'notes') loop perform (x->>'id')::uuid; if coalesce(length(trim(x->>'title')),0)=0 or length(x->>'body')>50000 then raise exception 'Note tidak valid';end if;end loop;
 for x in select jsonb_array_elements(d->'contacts') loop perform (x->>'id')::uuid; if coalesce(length(trim(x->>'name')),0)=0 then raise exception 'Nama contact wajib';end if;end loop;
 for x in select jsonb_array_elements(d->'days') loop perform (x->>'id')::uuid; if jsonb_typeof(x->'items')<>'array' or jsonb_array_length(x->'items')>100 then raise exception 'Day items tidak valid';end if;for y in select jsonb_array_elements(x->'items') loop perform (y->>'id')::uuid; if coalesce(length(trim(y->>'name')),0)=0 or length(y->>'description')>10000 then raise exception 'Item tidak valid';end if;end loop;end loop;
end $$;
create function private.check_journey() returns trigger language plpgsql set search_path='' as $$ declare field_name text;begin
 foreach field_name in array array['quote','start','end'] loop if new.data->>field_name is null then new.data:=jsonb_set(new.data,array[field_name],'""');end if;end loop;
 foreach field_name in array array['name','client','pic','stage','trip_type','client_type','start','end','quote'] loop if jsonb_typeof(new.data->field_name) is distinct from 'string' then raise exception 'Field % harus teks',field_name;end if;end loop;
 if jsonb_typeof(new.data->'people') is distinct from 'array' then raise exception 'Assigned people harus array';end if;
 perform private.validate_journey(new.workspace_id,new.kind,new.data);return new;end $$;
create trigger journey_validation before insert or update on public.journeys for each row execute function private.check_journey();
create function private.check_task() returns trigger language plpgsql set search_path='' as $$ declare k text;begin
 if new.parent is not null then select kind into k from public.journeys where id=new.parent and workspace_id=new.workspace_id; if k is distinct from new.data->>'context' then raise exception 'Task context tidak sesuai parent';end if;end if;
 if (tg_op='INSERT' or new.assignee is distinct from old.assignee or new.parent is distinct from old.parent) and not private.eligible(new.workspace_id,new.assignee,case new.data->>'context' when 'lead' then 'sales' when 'trip' then 'trips' else null end) then raise exception 'Task assignee tidak eligible';end if;
 perform private.assert_date(new.data->>'due');return new;
end $$;
create trigger task_validation before insert or update on public.tasks for each row execute function private.check_task();
create function private.check_transaction() returns trigger language plpgsql set search_path='' as $$ begin
 if new.trip is not null and not exists(select 1 from public.journeys where id=new.trip and workspace_id=new.workspace_id and kind='trip') then raise exception 'Context bukan Trip';end if;
 if new.transaction_date>(now() at time zone (select timezone from public.workspaces where id=new.workspace_id))::date then raise exception 'Future transaction date tidak diizinkan';end if;
 if new.data->>'amount' is distinct from new.amount_idr::text or new.data->>'date' is distinct from new.transaction_date::text or new.data->>'direction' is distinct from new.direction or new.data->>'category' is distinct from new.category_id or new.data->>'trip' is distinct from new.trip::text then raise exception 'Ledger fields tidak konsisten';end if;return new;
end $$;
create trigger transaction_validation before insert or update on public.transactions for each row execute function private.check_transaction();

create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships; j public.journeys; t public.tasks; tx public.transactions; p public.memberships; inv private.invitations;
 a text:=c->>'action';d jsonb:=coalesce(c->'data','{}');i uuid:=(c->>'id')::uuid;v integer:=(c->>'version')::integer;
 result uuid; nd jsonb; k text; md text; person uuid; par uuid; key uuid; temp jsonb; before_data jsonb; reason text;
begin
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 -- Serialize workspace membership/privilege changes with all mutations; max three users.
 perform 1 from public.workspaces where id=m.workspace_id for update;
 select fresh_member.* into m from public.memberships fresh_member where fresh_member.id=auth.uid() and fresh_member.status='active';if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 if a='create_journey' then
  k:=d->>'kind';md:=case k when 'lead' then 'sales' when 'trip' then 'trips' else null end;
  if md is null or not private.allowed(m.workspace_id,md,true) then raise exception 'Akses ditolak' using errcode='42501';end if;
  result:=gen_random_uuid();nd:=jsonb_build_object('kind',k,'name','','client','','pic',d->>'pic','people',jsonb_build_array(d->>'pic'),'start','','end','','guests',null,'quote','','trip_type','','client_type','','stage',case k when 'lead' then 'Drafts' else 'Planned' end,'lifecycle','active','source_lead',null,'converted_trip',null,'archived_at',null,'lost_reason','',
   'notes',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title',case k when 'lead' then 'Lead Notes' else 'Internal Notes' end,'body',case k when 'lead' then E'## Ringkasan kebutuhan\n\n## Preferensi\n\n## Follow-up\n\n## Risiko\n\n## Keputusan' else E'## Ringkasan perjalanan\n\n## Persiapan\n\n## Catatan operasional' end)),
   'contacts','[]'::jsonb,'days',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','','items','[]'::jsonb)));
  select nd||coalesce(jsonb_object_agg(e.key,e.value),'{}') into nd from jsonb_each(d) e where e.key in ('name','client','pic','people','start','end','guests','quote','trip_type','client_type','stage');
  insert into public.journeys(id,workspace_id,kind,data) values(result,m.workspace_id,k,nd);
 elsif a in ('update_journey','content','stage','archive','restore','convert') then
  select * into j from public.journeys where id=i and workspace_id=m.workspace_id for update;
  if j.id is null or not private.parent_allowed(i,true) then raise exception 'Akses ditolak' using errcode='42501';end if;
  if a='convert' and private.allowed(m.workspace_id,'trips',true) and j.data->>'converted_trip' is not null then return (j.data->>'converted_trip')::uuid;end if;
  if j.version is distinct from v then raise exception 'Data sudah berubah. Reload / Copy Changes.' using errcode='40001';end if;
  nd:=j.data;result:=j.id;
  if a='restore' then if j.kind<>'lead' or j.data->>'lifecycle'='converted' then raise exception 'Converted lead tidak dapat di-restore';end if;nd:=nd||jsonb_build_object('lifecycle','active','archived_at',null);if d->>'pic' is not null then nd:=nd||jsonb_build_object('pic',d->>'pic','people',jsonb_build_array(d->>'pic'));end if;
  else
   if j.data->>'lifecycle'<>'active' then raise exception 'Archive read-only';end if;
   if a='update_journey' then select nd||coalesce(jsonb_object_agg(e.key,e.value),'{}') into nd from jsonb_each(d) e where e.key in ('name','client','pic','people','start','end','guests','quote','trip_type','client_type','stage');
    if d->>'reassign_unfinished'='true' and nd->>'pic' is distinct from j.data->>'pic' then update public.tasks set assignee=(nd->>'pic')::uuid,data=data||jsonb_build_object('assignee',nd->>'pic'),version=version+1,updated_at=now() where parent=i and data->>'status'<>'Done' and data->>'cancelled_at' is null;end if;
   end if;
   if a='content' then select nd||coalesce(jsonb_object_agg(e.key,e.value),'{}') into nd from jsonb_each(d) e where e.key in ('notes','contacts','days');end if;
   if a='stage' then nd:=nd||jsonb_build_object('stage',d->>'stage');end if;
   if a='archive' then nd:=nd||jsonb_build_object('lifecycle',case when d->>'lost'='true' then 'lost' else 'archived' end,'archived_at',now(),'lost_reason',coalesce(d->>'reason',''));
    if coalesce(d->>'cancel','true')='true' then update public.tasks set data=data||jsonb_build_object('cancelled_at',now()),version=version+1,updated_at=now() where parent=i and data->>'status'<>'Done' and data->>'cancelled_at' is null;end if;
   end if;
   if a='convert' then
    if j.kind<>'lead' or not private.allowed(m.workspace_id,'trips',true) then raise exception 'Sales edit dan Trips edit wajib' using errcode='42501';end if;
    result:=gen_random_uuid();select nd||coalesce(jsonb_object_agg(e.key,e.value),'{}') into temp from jsonb_each(d) e where e.key in ('name','client','pic','people','start','end','guests','quote','trip_type','client_type');
    temp:=temp||jsonb_build_object('kind','trip','stage','Planned','source_lead',j.id,'converted_trip',null,'lifecycle','active','archived_at',null,'lost_reason','');
    temp:=jsonb_set(temp,'{notes}',(select coalesce(jsonb_agg(x||jsonb_build_object('id',gen_random_uuid())),'[]') from jsonb_array_elements(temp->'notes') x));
    temp:=jsonb_set(temp,'{contacts}',(select coalesce(jsonb_agg(x||jsonb_build_object('id',gen_random_uuid())),'[]') from jsonb_array_elements(temp->'contacts') x));
    temp:=jsonb_set(temp,'{days}',(select jsonb_agg(x||jsonb_build_object('id',gen_random_uuid(),'items',(select coalesce(jsonb_agg(y||jsonb_build_object('id',gen_random_uuid())),'[]') from jsonb_array_elements(x->'items') y))) from jsonb_array_elements(temp->'days') x));
    insert into public.journeys(id,workspace_id,kind,data,source_lead) values(result,m.workspace_id,'trip',temp,j.id);
    for t in select * from public.tasks where parent=i and data->>'status'<>'Done' and data->>'cancelled_at' is null for update loop
     person:=coalesce((d->'assignments'->>t.id::text)::uuid,t.assignee);if not private.eligible(m.workspace_id,person,'trips') then raise exception 'Pilih pengganti assignee tanpa Trips access';end if;
     update public.tasks set parent=result,assignee=person,data=data||jsonb_build_object('context','trip','parent',result,'assignee',person),version=version+1,updated_at=now() where id=t.id;
    end loop;
    nd:=nd||jsonb_build_object('lifecycle','converted','archived_at',now(),'converted_trip',result);
   end if;
  end if;
  update public.journeys set data=nd,version=version+1,updated_at=now() where id=i;
 elsif a='create_task' then
  k:=d->>'context';par:=nullif(d->>'parent','')::uuid;person:=(d->>'assignee')::uuid;
  if k not in ('internal','lead','trip') then raise exception 'Context tidak valid';end if;
  if k='internal' then if par is not null or (m.role<>'admin' and person<>m.id) then raise exception 'Internal task hanya diri sendiri' using errcode='42501';end if;
  else select * into j from public.journeys where id=par and workspace_id=m.workspace_id;if j.kind is distinct from k or j.data->>'lifecycle'<>'active' or not private.parent_allowed(par,true) then raise exception 'Parent read-only / akses ditolak' using errcode='42501';end if;end if;
  result:=gen_random_uuid();nd:=jsonb_build_object('title',trim(d->>'title'),'description',coalesce(d->>'description',''),'status','Assigned','assignee',person,'due',coalesce(d->>'due',''),'context',k,'parent',par,'completed_at',null,'cancelled_at',null,'created_by',m.id);
  insert into public.tasks(id,workspace_id,data,parent,assignee) values(result,m.workspace_id,nd,par,person);
 elsif a in ('task_status','update_task','cancel_task') then
  select * into t from public.tasks where id=i and workspace_id=m.workspace_id for update;
  if t.id is null then raise exception 'Task tidak ditemukan';end if;
  if t.parent is null then if m.role<>'admin' and t.assignee<>m.id then raise exception 'Akses ditolak' using errcode='42501';end if;
  else if not private.parent_allowed(t.parent,a<>'task_status') or (a='task_status' and m.role<>'admin' and t.assignee<>m.id and not private.parent_allowed(t.parent,true)) then raise exception 'Akses ditolak' using errcode='42501';end if;
   if a<>'task_status' and exists(select 1 from public.journeys where id=t.parent and data->>'lifecycle'<>'active') then raise exception 'Archive read-only';end if;
  end if;
  if t.version is distinct from v then raise exception 'Data sudah berubah. Reload / Copy Changes.' using errcode='40001';end if;
  if t.data->>'cancelled_at' is not null then raise exception 'Task cancelled';end if;
  nd:=t.data;person:=t.assignee;result:=i;
  if a='task_status' then nd:=nd||jsonb_build_object('status',d->>'status','completed_at',case when d->>'status'='Done' then to_jsonb(now()) else 'null'::jsonb end);end if;
  if a='cancel_task' then nd:=nd||jsonb_build_object('cancelled_at',now());end if;
  if a='update_task' then person:=(d->>'assignee')::uuid;if t.parent is null and m.role<>'admin' and person<>m.id then raise exception 'Akses ditolak' using errcode='42501';end if;nd:=nd||jsonb_build_object('title',trim(d->>'title'),'description',coalesce(d->>'description',''),'due',coalesce(d->>'due',''),'assignee',person);end if;
  update public.tasks set data=nd,assignee=person,version=version+1,updated_at=now() where id=i;
 elsif a in ('create_transaction','edit_transaction','void_transaction') then
  if not private.allowed(m.workspace_id,'finance',true) then raise exception 'Akses Finance ditolak' using errcode='42501';end if;
  if a='create_transaction' then key:=(d->>'idempotency_key')::uuid;if key is null then raise exception 'Idempotency key wajib';end if;select * into tx from public.transactions where workspace_id=m.workspace_id and idempotency_key=key;if tx.id is not null then
   perform private.assert_money(d->>'amount');
   if tx.amount_idr is distinct from (d->>'amount')::bigint or tx.transaction_date::text is distinct from d->>'date' or tx.direction is distinct from d->>'direction' or tx.category_id is distinct from d->>'category' or coalesce(tx.trip::text,'') is distinct from coalesce(nullif(d->>'trip',''),'') or tx.data->>'description' is distinct from trim(d->>'description') then raise exception 'Idempotency key sudah tersimpan dengan data berbeda. Reload lalu koreksi entry yang ada.' using errcode='40001';end if;
   return tx.id;end if;
  else select * into tx from public.transactions where id=i and workspace_id=m.workspace_id for update;if tx.id is null or (tx.trip is not null and not private.allowed(m.workspace_id,'trips')) then raise exception 'Akses ditolak' using errcode='42501';end if;if tx.version is distinct from v then raise exception 'Data sudah berubah. Reload / Copy Changes.' using errcode='40001';end if;if tx.data->>'status'='void' then raise exception 'Void final';end if;reason:=trim(d->>'reason');if coalesce(length(reason),0)=0 then raise exception 'Alasan wajib';end if;before_data:=tx.data;end if;
  if a='void_transaction' then result:=i;nd:=tx.data||jsonb_build_object('status','void','void_by',m.id,'void_at',now(),'reason',reason);update public.transactions set data=nd,version=version+1,updated_at=now() where id=i;
  else
   par:=nullif(d->>'trip','')::uuid;if par is not null and not private.allowed(m.workspace_id,'trips') then raise exception 'Trips access wajib untuk transaksi Trip' using errcode='42501';end if;
   perform private.assert_money(d->>'amount');perform private.assert_date(d->>'date',true);
   nd:=jsonb_build_object('date',d->>'date','direction',d->>'direction','amount',(d->>'amount')::bigint::text,'category',d->>'category','trip',par,'description',trim(d->>'description'),'status','posted','created_by',case when a='create_transaction' then m.id else (tx.data->>'created_by')::uuid end,'void_by',null,'void_at',null,'reason',coalesce(reason,''),'idempotency_key',case when a='create_transaction' then key else tx.idempotency_key end);
   if a='create_transaction' then result:=gen_random_uuid();insert into public.transactions(id,workspace_id,data,trip,amount_idr,transaction_date,direction,category_id,idempotency_key) values(result,m.workspace_id,nd,par,(d->>'amount')::bigint,(d->>'date')::date,d->>'direction',d->>'category',key);
   else result:=i;update public.transactions set data=nd,trip=par,amount_idr=(d->>'amount')::bigint,transaction_date=(d->>'date')::date,direction=d->>'direction',category_id=d->>'category',version=version+1,updated_at=now() where id=i;end if;
  end if;
 elsif a in ('invite','resend_invite','revoke_invite','update_person','deactivate') then
  if m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
  if a='invite' then
   if (select count(*) from public.memberships where workspace_id=m.workspace_id and status='active')+(select count(*) from private.invitations where workspace_id=m.workspace_id and status not in ('accepted','revoked'))>=3 then raise exception 'Tiga slot sudah terisi';end if;
   if exists(select 1 from public.memberships where workspace_id=m.workspace_id and email=lower(trim(d->>'email')) and status<>'deactivated') then raise exception 'Email sudah terdaftar';end if;
   if d->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(length(trim(d->>'name')),0)=0 then raise exception 'Nama/email tidak valid';end if;
   temp:=coalesce(d->'privileges','{"sales":"none","trips":"none","finance":"none"}');
   if not(temp ?& array['sales','trips','finance']) or temp->>'sales' not in ('none','view','edit') or temp->>'trips' not in ('none','view','edit') or temp->>'finance' not in ('none','view','edit') then raise exception 'Privilege tidak valid';end if;
   insert into private.invitations(workspace_id,email,name,privileges,status,invited_by) values(m.workspace_id,lower(trim(d->>'email')),trim(d->>'name'),temp,'pending',m.id) returning id into result;
  elsif a in ('resend_invite','revoke_invite') then
   select * into inv from private.invitations where id=i and workspace_id=m.workspace_id for update;if inv.id is null or inv.status in ('accepted','revoked') then raise exception 'Invitation tidak aktif';end if;
   update private.invitations set status=case when a='resend_invite' then 'pending' else 'revoked' end,generation=gen_random_uuid(),expires_at=now()+interval '7 days',version=version+1 where id=i;result:=i;
  else
   select * into p from public.memberships where id=i and workspace_id=m.workspace_id for update;if p.id is null then raise exception 'Member tidak ditemukan';end if;
   if p.version is distinct from v then raise exception 'Privilege sudah berubah. Reload sebelum menyimpan.' using errcode='40001';end if;
   if a='deactivate' then if p.role='admin' and (select count(*) from public.memberships where workspace_id=m.workspace_id and role='admin' and status='active')<=1 then raise exception 'Admin aktif terakhir tidak dapat dinonaktifkan';end if;update public.memberships set status='deactivated',version=version+1 where id=i;
   else update public.memberships set privileges=d->'privileges',version=version+1 where id=i;end if;result:=i;
  end if;
 else raise exception 'Aksi tidak tersedia';end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,a,result::text,case when a in ('edit_transaction','void_transaction') then jsonb_build_object('before',before_data,'after',nd,'reason',reason) when a='convert' then jsonb_build_object('source_lead',i,'trip',result) else '{}'::jsonb end);
 return result;
end $$;
revoke all on function private.command(jsonb) from public,anon,authenticated;
create function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
revoke all on function public.app_command(jsonb) from public,anon;
grant execute on function public.app_command(jsonb),private.command(jsonb) to authenticated;

-- Keep values exact as decimal strings, including aggregates.
create function private.cash_totals(rows jsonb) returns jsonb language sql immutable set search_path='' as $$
 with x as(select coalesce(sum((v->>'amount')::numeric) filter(where v->>'direction'='in' and v->>'status'='posted'),0) a,coalesce(sum((v->>'amount')::numeric) filter(where v->>'direction'='out' and v->>'status'='posted'),0) b from jsonb_array_elements(rows) v)
 select jsonb_build_object('moneyIn',a::text,'moneyOut',b::text,'net',(a-b)::text) from x
$$;
create function private.filtered_transactions(w uuid,f jsonb) returns setof public.transactions language sql stable set search_path='' as $$select t.* from public.transactions t where t.workspace_id=w
 and (coalesce(f->>'from','')='' or t.transaction_date>=(f->>'from')::date) and (coalesce(f->>'to','')='' or t.transaction_date<=(f->>'to')::date)
 and (coalesce(f->>'direction','')='' or t.direction=f->>'direction') and (coalesce(f->>'category','')='' or t.category_id=f->>'category')
 and (coalesce(f->>'trip','')='' or (f->>'trip'='general' and t.trip is null) or t.trip::text=f->>'trip')
 and (coalesce(f->>'status','') in ('','all') or t.data->>'status'=f->>'status')
 and (coalesce(f->>'search','')='' or position(lower(f->>'search') in lower(t.data->>'description'))>0)$$;
create function private.snapshot(view_name text, filters jsonb, record_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.memberships; w uuid; js jsonb:='[]';ts jsonb:='[]';txs jsonb:='[]';ledger jsonb:='[]';cats jsonb:='[]';invs jsonb:='[]';cashrows jsonb:='[]';reassign jsonb:='[]';cnt integer:=0;counts jsonb:='{}';off integer:=greatest(0,coalesce((filters->>'page')::integer,0))*50;tz text;
begin
 m:=private.me();if m.id is null then raise exception 'Silakan login / membership inactive' using errcode='42501';end if;w:=m.workspace_id;
 if view_name in ('sales','trips','finance') and not private.allowed(w,view_name) or view_name='people' and m.role<>'admin' then raise exception 'Akses ditolak' using errcode='42501';end if;
 select timezone into tz from public.workspaces where id=w;
 if view_name='home' then
  if m.role<>'admin' and coalesce(filters->>'assignee',m.id::text)<>m.id::text then raise exception 'Home hanya task sendiri' using errcode='42501';end if;
  select coalesce(jsonb_agg(private.row_json(t.data,t.id,t.version,t.created_at,t.updated_at)),'[]') into ts from public.tasks t where t.workspace_id=w and t.data->>'cancelled_at' is null and ((m.role='admin' and filters->>'assignee'='all') or t.assignee::text=coalesce(nullif(filters->>'assignee',''),m.id::text)) and (t.parent is null or private.parent_allowed(t.parent));
  select coalesce(jsonb_object_agg(status,n),'{}') into counts from (select v->>'status' status,count(*) n from jsonb_array_elements(ts) v group by v->>'status') x;
  select coalesce(jsonb_agg(v order by case when v->>'status'='Done' then v->>'completed_at' else null end desc,coalesce(nullif(v->>'due',''),'9999')),'[]') into ts from (select v,row_number() over(partition by v->>'status' order by case when v->>'status'='Done' then v->>'completed_at' else null end desc,coalesce(nullif(v->>'due',''),'9999')) n from jsonb_array_elements(ts) v) x where n<=off+50;
  select coalesce(jsonb_agg(private.row_json(jsonb_build_object('kind',j.kind,'name',j.data->>'name','client',j.data->>'client','lifecycle',j.data->>'lifecycle'),j.id,j.version,j.created_at,j.updated_at)),'[]') into js from public.journeys j where private.parent_allowed(j.id) and exists(select 1 from jsonb_array_elements(ts) v where v->>'parent'=j.id::text);
 end if;
 if view_name in ('sales','trips') then
  if record_id is not null and not private.parent_allowed(record_id) then raise exception 'Record tidak ditemukan / akses ditolak' using errcode='42501';end if;
  select count(*) into cnt from public.journeys j where j.workspace_id=w and j.kind=case view_name when 'sales' then 'lead' else 'trip' end and (record_id is null or j.id=record_id) and (record_id is not null or case when filters->>'lifecycle'='archive' then j.data->>'lifecycle'<>'active' else j.data->>'lifecycle'='active' end) and (coalesce(filters->>'pic','')='' or j.data->>'pic'=filters->>'pic') and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower((j.data->>'name')||' '||(j.data->>'client')))>0);
  select coalesce(jsonb_agg(v),'[]') into js from (select private.row_json(case when record_id is not null then j.data else j.data-array['notes','days','contacts'] end,j.id,j.version,j.created_at,j.updated_at) v from public.journeys j where j.workspace_id=w and j.kind=case view_name when 'sales' then 'lead' else 'trip' end and (record_id is null or j.id=record_id) and (record_id is not null or case when filters->>'lifecycle'='archive' then j.data->>'lifecycle'<>'active' else j.data->>'lifecycle'='active' end) and (coalesce(filters->>'pic','')='' or j.data->>'pic'=filters->>'pic') and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower((j.data->>'name')||' '||(j.data->>'client')))>0) order by j.created_at desc limit 50 offset case when record_id is null then off else 0 end) x;
  select coalesce(jsonb_agg(private.row_json(t.data,t.id,t.version,t.created_at,t.updated_at)),'[]') into ts from public.tasks t where t.data->>'cancelled_at' is null and exists(select 1 from jsonb_array_elements(js) v where v->>'id'=t.parent::text);
 end if;
 if private.allowed(w,'finance') and (view_name='finance' or view_name='trips' and record_id is not null) then
  select coalesce(jsonb_agg(private.row_json(t.data,t.id,t.version,t.created_at,t.updated_at) order by t.transaction_date desc,t.created_at desc),'[]') into ledger from private.filtered_transactions(w,case when record_id is not null then filters||jsonb_build_object('trip',record_id) else filters end) t;
  cnt:=jsonb_array_length(ledger);select coalesce(jsonb_agg(v),'[]') into txs from (select v from jsonb_array_elements(ledger) v limit 50 offset off) x;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'direction',c.direction)),'[]') into cats from public.finance_categories c;
  select coalesce(jsonb_agg(jsonb_build_object('id',ctx,'name',case when ctx='general' then 'General' else (select j.data->>'name' from public.journeys j where j.id::text=ctx and j.workspace_id=w) end)||private.cash_totals(rows)),'[]') into cashrows from (select coalesce(v->>'trip','general') ctx,jsonb_agg(v) rows from jsonb_array_elements(ledger) v group by coalesce(v->>'trip','general')) x;
  if view_name='finance' then select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'name',j.data->>'name','kind','trip')),'[]') into js from public.journeys j where j.workspace_id=w and j.kind='trip';end if;
 end if;
 if view_name='people' then
  select coalesce(jsonb_agg(to_jsonb(i)-array['workspace_id','invited_by','expires_at']),'[]') into invs from private.invitations i where workspace_id=w;
  select coalesce(jsonb_agg(private.row_json(t.data,t.id,t.version,t.created_at,t.updated_at)),'[]') into reassign from public.tasks t where t.workspace_id=w and t.parent is not null and t.data->>'status'<>'Done' and t.data->>'cancelled_at' is null and not private.eligible(w,t.assignee,case t.data->>'context' when 'lead' then 'sales' else 'trips' end);
 end if;
 return jsonb_build_object('user',private.person_json(m),'people',(select coalesce(jsonb_agg(private.person_json(p)),'[]') from public.memberships p where p.workspace_id=w),'invitations',invs,'journeys',js,'tasks',ts,'transactions',txs,'categories',cats,'timezone',tz,'today',(now() at time zone tz)::date::text,'demo',false,'totals',private.cash_totals(ledger),'cashRows',cashrows,'count',cnt,'taskCounts',counts,'reassignment',reassign);
end $$;
revoke all on function private.snapshot(text,jsonb,uuid) from public,anon,authenticated;
create function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
revoke all on function public.app_snapshot(text,jsonb,uuid) from public,anon;
grant execute on function public.app_snapshot(text,jsonb,uuid),private.snapshot(text,jsonb,uuid) to authenticated;

create function private.export_rows(filters jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare m public.memberships;rows jsonb;begin
 m:=private.me();if m.id is null or m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
 select coalesce(jsonb_agg(private.row_json(t.data,t.id,t.version,t.created_at,t.updated_at) order by t.transaction_date desc,t.created_at desc),'[]') into rows from private.filtered_transactions(m.workspace_id,filters) t;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'csv_export',m.workspace_id::text,jsonb_build_object('filters',filters,'row_count',jsonb_array_length(rows)));return rows;
end$$;
create function public.app_export(filters jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.export_rows(filters)$$;
revoke all on function private.export_rows(jsonb),public.app_export(jsonb) from public,anon;
grant execute on function private.export_rows(jsonb),public.app_export(jsonb) to authenticated;

-- Invitation provider handoff: service-only; membership authorization remains in DB.
create function public.invitation_delivery(invitation_id uuid,generation_id uuid,provider_id uuid,delivery_status text) returns void language plpgsql security definer set search_path='' as $$declare i private.invitations;begin
 if delivery_status not in ('sent','failed') then raise exception 'Invalid delivery status';end if;
 select * into i from private.invitations where id=invitation_id and generation=generation_id and status='pending' for update;if i.id is null then raise exception 'Invitation replaced/revoked';end if;
 update private.invitations set status=delivery_status,provider_user=provider_id,version=version+1 where id=i.id;
 insert into private.audit_events(workspace_id,actor,action,entity) values(i.workspace_id,i.invited_by,'invitation_'||delivery_status,i.id::text);
end$$;
revoke all on function public.invitation_delivery(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.invitation_delivery(uuid,uuid,uuid,text) to service_role;
create function private.activate(generation_id uuid) returns void language plpgsql security definer set search_path='' as $$declare i private.invitations;email_value text;password_value text;begin
 if auth.uid() is null then raise exception 'Silakan login' using errcode='42501';end if;
 select email,encrypted_password into email_value,password_value from auth.users where id=auth.uid();
 select * into i from private.invitations where generation=generation_id and provider_user=auth.uid() and email=lower(email_value) and status='sent' and expires_at>now();
 if i.id is null then raise exception 'Invitation expired / revoked / sudah digunakan' using errcode='42501';end if;
 if coalesce(password_value,'')='' then raise exception 'Buat password sebelum activation' using errcode='42501';end if;
 perform 1 from public.workspaces where id=i.workspace_id for update;
 select * into i from private.invitations where generation=generation_id and provider_user=auth.uid() and email=lower(email_value) and status='sent' and expires_at>now() for update;if i.id is null then raise exception 'Invitation expired / revoked / sudah digunakan' using errcode='42501';end if;
 insert into public.memberships(id,workspace_id,name,email,role,status,privileges) values(auth.uid(),i.workspace_id,i.name,i.email,'member','active',i.privileges) on conflict(id) do update set name=excluded.name,workspace_id=excluded.workspace_id,status='active',privileges=excluded.privileges,role='member',version=memberships.version+1;
 update private.invitations set status='accepted',version=version+1 where id=i.id;
 insert into private.audit_events(workspace_id,actor,action,entity) values(i.workspace_id,auth.uid(),'invitation_accept',i.id::text);
end$$;
create function public.activate_membership(generation_id uuid) returns void language sql security invoker set search_path='' as $$select private.activate(generation_id)$$;
revoke all on function private.activate(uuid),public.activate_membership(uuid) from public,anon;
grant execute on function private.activate(uuid),public.activate_membership(uuid) to authenticated;
-- New functions are not executable by default. Explicit grants above are the API.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

create function private.check_invitation(generation_id uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not exists(select 1 from private.invitations i join auth.users u on u.id=i.provider_user where i.generation=generation_id and i.provider_user=auth.uid() and i.email=lower(u.email) and i.status='sent' and i.expires_at>now()) then raise exception 'Invitation expired / revoked / sudah digunakan' using errcode='42501';end if;return true;
end$$;
create function public.check_invitation(generation_id uuid) returns boolean language sql security invoker set search_path='' as $$select private.check_invitation(generation_id)$$;
revoke all on function private.check_invitation(uuid),public.check_invitation(uuid) from public,anon;
grant execute on function private.check_invitation(uuid),public.check_invitation(uuid) to authenticated;
-- Explicit private API; validators and row serializers cannot be probed directly.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.me(),private.allowed(uuid,text,boolean),private.admin(uuid),private.parent_allowed(uuid,boolean),private.command(jsonb),private.snapshot(text,jsonb,uuid),private.export_rows(jsonb),private.activate(uuid),private.check_invitation(uuid) to authenticated;
