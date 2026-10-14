-- Role supplies administrative capabilities; module privileges remain explicit.
update public.memberships set privileges=privileges||jsonb_build_object('docs',case when role='admin' then 'edit' else 'none' end) where not privileges ? 'docs';
alter table public.memberships add constraint docs_privilege check(coalesce(privileges->>'docs','none') in ('none','view','edit'));
create or replace function private.allowed(w uuid,module text,editing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.id=auth.uid() and m.status='active' and m.workspace_id=w and case when editing then m.privileges->>module='edit' else m.privileges->>module in ('view','edit') end)
$$;
create or replace function private.eligible(w uuid,p uuid,module text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.id=p and m.workspace_id=w and m.status='active' and (module is null or m.privileges->>module in ('view','edit')))
$$;
create or replace function private.valid_privileges(p jsonb) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(p)='object' and p ?& array['sales','trips','finance'] and p->>'sales' in ('none','view','edit') and p->>'trips' in ('none','view','edit') and p->>'finance' in ('none','view','edit') and coalesce(p->>'docs','none') in ('none','view','edit'),false)$$;
alter policy templates_read on public.templates using(private.allowed(workspace_id,case kind when 'lead_note' then 'sales' when 'internal_doc' then 'docs' else 'trips' end));
alter policy trip_stages_read on public.trip_stages using(private.allowed(workspace_id,'trips'));
alter policy stages_read on public.sales_stages using(private.allowed(workspace_id,'sales'));

-- Exact decimal IDR throughout transactions, quotations and budgets.
alter table public.transactions alter column amount_idr type numeric(21,2);
alter table public.trip_budgets alter column amount_idr type numeric(21,2);
create or replace function private.assert_money(a text,positive boolean default true) returns void language plpgsql set search_path='' as $$begin
 if a is null or a !~ '^[0-9]+(\.[0-9]{1,2})?$' or a::numeric>9223372036854775807.99 or (positive and a::numeric<=0) then raise exception 'Nominal IDR tidak valid: maksimal 2 desimal';end if;
end$$;
create function private.money_text(a numeric) returns text language sql immutable set search_path='' as $$select case when a::text like '%.%' then rtrim(rtrim(a::text,'0'),'.') else a::text end$$;
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.transactions'::regclass and contype='c' and pg_get_constraintdef(oid) like '%description%' loop execute format('alter table public.transactions drop constraint %I',c.conname);end loop;
end$$;
create or replace function private.check_transaction() returns trigger language plpgsql set search_path='' as $$begin
 if new.trip is not null and not exists(select 1 from public.journeys where id=new.trip and workspace_id=new.workspace_id and kind='trip') then raise exception 'Context bukan Trip';end if;
 if new.transaction_date>(now() at time zone private.ui_timezone(current_setting('app.ui_timezone',true)))::date then raise exception 'Future transaction date tidak diizinkan';end if;
 perform private.assert_money(new.data->>'amount');
 if (new.data->>'amount')::numeric is distinct from new.amount_idr or new.data->>'date' is distinct from new.transaction_date::text or new.data->>'direction' is distinct from new.direction or new.data->>'category' is distinct from new.category_id or new.data->>'trip' is distinct from new.trip::text then raise exception 'Ledger fields tidak konsisten';end if;
 if coalesce(length(trim(new.data->>'title')),0) not between 1 and 200 or length(coalesce(new.data->>'description',''))>5000 then raise exception 'Judul / catatan tidak valid';end if;
 return new;
end$$;
update public.transactions set data=data||jsonb_build_object('title',left(coalesce(nullif(data->>'description',''),'Transaksi'),200));
alter table public.transactions add constraint transaction_title check(length(trim(data->>'title')) between 1 and 200);
create table public.transaction_corrections(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),transaction_id uuid not null references public.transactions(id),transaction_version integer not null,
 proposed jsonb not null,original jsonb not null,reason text not null check(length(trim(reason)) between 1 and 5000),requested_by uuid not null references public.memberships(id),status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references public.memberships(id),reviewed_at timestamptz,review_reason text,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index correction_pending on public.transaction_corrections(transaction_id) where status='pending';
alter table public.transaction_corrections enable row level security;
revoke all on public.transaction_corrections from public,anon,authenticated;
grant select on public.transaction_corrections to authenticated;
create policy correction_read on public.transaction_corrections for select to authenticated using(private.allowed(workspace_id,'finance'));

update public.finance_categories set name=case id
 when 'in-0' then 'Uang muka pelanggan' when 'in-1' then 'Pelunasan jasa perjalanan' when 'in-2' then 'Pendapatan lain-lain'
 when 'out-0' then 'Beban transportasi' when 'out-1' then 'Beban akomodasi' when 'out-2' then 'Beban konsumsi' when 'out-3' then 'Beban tiket dan aktivitas'
 when 'out-4' then 'Beban jasa guide dan vendor' when 'out-5' then 'Beban pemasaran' when 'out-6' then 'Beban operasional' when 'out-7' then 'Pengembalian dana pelanggan' else name end;

-- A fixed active pipeline. Terminal stages are retained for archive history.
create or replace function private.seed_trip_stages(w uuid) returns void language sql set search_path='' as $$
 insert into public.trip_stages(workspace_id,id,label,position,semantic,is_default) values
 (w,'Planned','Planned',0,'open',true),(w,'Confirmed','Confirmed',1,'open',false),(w,'In Progress','In Progress',2,'open',false),(w,'Completed','Completed',3,'completed',false),(w,'Cancelled','Cancelled',4,'cancelled',false) on conflict do nothing;
$$;
do $$declare w uuid;begin
 for w in select id from public.workspaces loop
  update public.trip_stages set is_default=false where workspace_id=w;
  perform private.seed_trip_stages(w);
  update public.trip_stages set active=true,label=id,position=case id when 'Planned' then 0 when 'Confirmed' then 1 when 'In Progress' then 2 when 'Completed' then 3 else 4 end,is_default=(id='Planned') where workspace_id=w and id in ('Planned','Confirmed','In Progress','Completed','Cancelled');
  update public.journeys j set data=jsonb_set(data,'{stage}','"Planned"'),version=version+1 where workspace_id=w and kind='trip' and data->>'lifecycle'='active' and exists(select 1 from public.trip_stages s where s.workspace_id=w and s.id=j.data->>'stage' and s.semantic='open' and s.id not in ('Planned','Confirmed','In Progress'));
  update public.trip_stages set active=false,is_default=false where workspace_id=w and semantic='open' and id not in ('Planned','Confirmed','In Progress');
 end loop;
end$$;
create function private.trip_lifecycle() returns trigger language plpgsql set search_path='' as $$declare semantic text;begin
 if new.kind='trip' then
  select s.semantic into semantic from public.trip_stages s where s.workspace_id=new.workspace_id and s.id=new.data->>'stage';
  if semantic in ('completed','cancelled') then new.data:=new.data||jsonb_build_object('lifecycle','archived','archived_at',coalesce(new.data->>'archived_at',now()::text));end if;
 end if;return new;
end$$;
create trigger a_trip_lifecycle before insert or update on public.journeys for each row execute function private.trip_lifecycle();
update public.journeys set data=data,version=version+1 where kind='trip' and data->>'lifecycle'='active' and exists(select 1 from public.trip_stages s where s.workspace_id=journeys.workspace_id and s.id=journeys.data->>'stage' and s.semantic in ('completed','cancelled'));
create function private.advance_trips(w uuid) returns void language plpgsql set search_path='' as $$declare j public.journeys;begin
 perform 1 from public.workspaces where id=w for update;
 for j in select x.* from public.journeys x join public.workspaces ws on ws.id=x.workspace_id where x.workspace_id=w and kind='trip' and data->>'lifecycle'='active' and data->>'stage'='Confirmed' and (data->>'start')::date<=(now() at time zone ws.timezone)::date+2 for update of x loop
  update public.journeys set data=jsonb_set(data,'{stage}','"In Progress"'),version=version+1,updated_at=now() where id=j.id;
  insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(w,coalesce(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid),'trip_auto_progress',j.id::text,jsonb_build_object('before',jsonb_build_object('stage','Confirmed'),'after',jsonb_build_object('stage','In Progress'),'rule','H-2','automatic',true));
 end loop;
end$$;
create function private.advance_all_trips() returns void language plpgsql set search_path='' as $$declare w uuid;begin
 for w in select id from public.workspaces loop perform private.advance_trips(w);end loop;
end$$;
revoke all on function private.advance_all_trips() from public,anon,authenticated;
-- The hosted database runs the same rule without requiring an open browser.
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
  perform cron.schedule('travel-os-trip-progress','* * * * *','select private.advance_all_trips();');
 end if;
end$$;

create table public.internal_docs(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),title text not null check(length(trim(title)) between 1 and 200),date date not null,creator uuid not null,category text not null default 'General' check(length(trim(category)) between 1 and 100),body text not null default '' check(length(body)<=50000),
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,workspace_id),foreign key(workspace_id,creator) references public.memberships(workspace_id,id)
);
create index docs_date on public.internal_docs(workspace_id,date desc,created_at desc);
alter table public.internal_docs enable row level security;
revoke all on public.internal_docs from public,anon,authenticated;
grant select on public.internal_docs to authenticated;
create policy docs_read on public.internal_docs for select to authenticated using(private.allowed(workspace_id,'docs'));
alter table public.templates drop constraint templates_kind_check;
alter table public.templates add constraint templates_kind_check check(kind in ('lead_note','trip_note','itinerary','internal_doc'));
insert into public.templates(workspace_id,name,kind,content) select id,'Internal document','internal_doc',to_jsonb(E'## Ringkasan\n\n## Pembahasan\n\n## Keputusan\n\n## Tindak lanjut'::text) from public.workspaces;

create function private.workspace_doc_template() returns trigger language plpgsql set search_path='' as $$begin
 insert into public.templates(workspace_id,name,kind,content) values(new.id,'Internal document','internal_doc',to_jsonb(E'## Ringkasan\n\n## Pembahasan\n\n## Keputusan\n\n## Tindak lanjut'::text));return new;
end$$;
create trigger workspace_doc_template after insert on public.workspaces for each row execute function private.workspace_doc_template();
revoke all on function private.workspace_doc_template() from public,anon,authenticated;

-- Adapt earlier functions without replacing unrelated local/P2 behavior.
do $$declare original text;definition text;begin
 original:=pg_get_functiondef('private.command_p1(jsonb)'::regprocedure);
 definition:=replace(original,'if m.role<>''admin'' then raise exception ''Admin only'' using errcode=''42501'';end if;',
 'if not private.allowed(m.workspace_id,case when a in (''save_stage'',''retire_stage'') then ''sales'' when a=''save_category'' then ''finance'' when d->>''kind''=''internal_doc'' then ''docs'' when d->>''kind''=''lead_note'' then ''sales'' else ''trips'' end,true) then raise exception ''Akses konfigurasi ditolak'' using errcode=''42501'';end if;');
 definition:=replace(definition,'in (''lead_note'',''trip_note'')','in (''lead_note'',''trip_note'',''internal_doc'')');
 execute definition;
 original:=pg_get_functiondef('private.snapshot_p1(text,jsonb,uuid)'::regprocedure);
 definition:=replace(original,'if view_name in (''configuration'',''audit'') and m.role<>''admin'' then raise exception ''Admin only'' using errcode=''42501'';end if;',
 'if view_name in (''configuration'',''audit'') and not (private.allowed(m.workspace_id,''sales'') or private.allowed(m.workspace_id,''trips'') or private.allowed(m.workspace_id,''finance'') or private.allowed(m.workspace_id,''docs'')) then raise exception ''Akses ditolak'' using errcode=''42501'';end if;');
 definition:=replace(definition,'then ''people'' else view_name','then ''home'' else view_name');
 definition:=replace(definition,'case kind when ''lead_note'' then ''sales'' else ''trips'' end','case kind when ''lead_note'' then ''sales'' when ''internal_doc'' then ''docs'' else ''trips'' end');
 execute definition;
 -- Home administrators can inspect all tasks, including inaccessible parent modules.
 foreach original in array array['private.snapshot_core(text,jsonb,uuid)','private.snapshot_p1(text,jsonb,uuid)'] loop
  definition:=pg_get_functiondef(original::regprocedure);
  definition:=replace(definition,'(t.parent is null or private.parent_allowed(t.parent))','(m.role=''admin'' or t.parent is null or private.parent_allowed(t.parent))');
  execute definition;
 end loop;
 original:=pg_get_functiondef('private.export_rows(jsonb)'::regprocedure);
 definition:=replace(original,'m.id is null or m.role<>''admin''','m.id is null or not private.allowed(m.workspace_id,''finance'')');execute definition;
 original:=pg_get_functiondef('private.share_manage(text,uuid,uuid,integer,jsonb,text,integer)'::regprocedure);
 definition:=replace(original,'m.id is null or m.role<>''admin''','m.id is null or not private.allowed(m.workspace_id,''trips'',true)');execute definition;
 original:=pg_get_functiondef('private.command_core(jsonb)'::regprocedure);
 definition:=replace(original,'m.role<>''admin'' and person<>m.id','person<>m.id');
 definition:=replace(definition,'m.role<>''admin'' and t.assignee<>m.id','t.assignee<>m.id');execute definition;
 original:=pg_get_functiondef('private.filtered_transactions(uuid,jsonb)'::regprocedure);
 definition:=replace(original,'lower(t.data->>''description'')','lower(coalesce(t.data->>''title'','''')||'' ''||coalesce(t.data->>''description'',''''))');execute definition;
end$$;

alter function private.command(jsonb) rename to command_before_refinements;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare m public.memberships;d jsonb:=coalesce(c->'data','{}');a text:=c->>'action';i uuid:=(c->>'id')::uuid;v integer:=(c->>'version')::integer;r uuid;tx public.transactions;cr public.transaction_corrections;p public.memberships;doc public.internal_docs;cat public.finance_categories;j public.journeys;tpl public.templates;b public.trip_budgets;par uuid;nd jsonb;before_data jsonb;key uuid;reason text;amount numeric;
begin
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 select fresh_member.* into m from public.memberships fresh_member where fresh_member.id=auth.uid() and fresh_member.status='active';if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform pg_catalog.set_config('app.ui_timezone',private.ui_timezone(c->>'timezone'),true);
 if a in ('save_trip_stage','retire_trip_stage') then raise exception 'Pipeline Trips menggunakan Planned, Confirmed, In Progress';end if;
 if a='update_person' then
  if m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
  select * into p from public.memberships where id=i and workspace_id=m.workspace_id for update;
  if p.id is null then raise exception 'Member tidak ditemukan';end if;
  if p.version is distinct from v then raise exception 'Privilege berubah. Reload.' using errcode='40001';end if;
  if coalesce(d->>'role',p.role) not in ('admin','member') then raise exception 'Role tidak valid';end if;
  if p.role='admin' and d->>'role'='member' and p.status='active' and (select count(*) from public.memberships where workspace_id=m.workspace_id and role='admin' and status='active')<=1 then raise exception 'Admin aktif terakhir tidak dapat diturunkan';end if;
  before_data:=private.person_json(p);
  update public.memberships set role=coalesce(d->>'role',role),privileges=coalesce(d->'privileges',privileges),version=version+1 where id=i;r:=i;
  select private.person_json(x) into nd from public.memberships x where id=i;
 elsif a in ('create_doc','update_doc') then
  if not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses Docs ditolak' using errcode='42501';end if;
  perform private.assert_date(d->>'date',true);
  if a='create_doc' then r:=gen_random_uuid();insert into public.internal_docs(id,workspace_id,title,date,creator,category,body) values(r,m.workspace_id,trim(d->>'title'),(d->>'date')::date,m.id,trim(d->>'category'),coalesce(d->>'body',''));
  else
   select * into doc from public.internal_docs where id=i and workspace_id=m.workspace_id for update;
   if doc.id is null then raise exception 'Dokumen tidak ditemukan';end if;
   if doc.version is distinct from v then raise exception 'Dokumen berubah. Reload / Copy Changes.' using errcode='40001';end if;
   before_data:=to_jsonb(doc)-'workspace_id';r:=i;
   update public.internal_docs set title=trim(d->>'title'),date=(d->>'date')::date,category=trim(d->>'category'),body=coalesce(d->>'body',''),version=version+1,updated_at=now() where id=i;
  end if;
  select to_jsonb(x)-'workspace_id' into nd from public.internal_docs x where id=r;
 elsif a='save_budget' then
  if not private.allowed(m.workspace_id,'finance',true) then raise exception 'Akses Finance ditolak' using errcode='42501';end if;
  par:=(d->>'trip')::uuid;select * into j from public.journeys where id=par and workspace_id=m.workspace_id and kind='trip';
  if j.id is null or j.data->>'lifecycle'<>'active' then raise exception 'Trip tidak aktif';end if;
  select * into cat from public.finance_categories where id=d->>'category' and active;if cat.id is null then raise exception 'Kategori tidak aktif';end if;
  perform private.assert_money(d->>'amount',false);amount:=(d->>'amount')::numeric;
  select * into b from public.trip_budgets where workspace_id=m.workspace_id and trip_id=par and category_id=cat.id for update;
  if (b.trip_id is null and v is not null) or (b.trip_id is not null and b.version is distinct from v) then raise exception 'Budget berubah. Reload.' using errcode='40001';end if;
  before_data:=jsonb_build_object('amount',private.money_text(b.amount_idr),'category',cat.id,'direction',cat.direction);nd:=jsonb_build_object('amount',private.money_text(amount),'category',cat.id,'direction',cat.direction);
  insert into public.trip_budgets(workspace_id,trip_id,category_id,amount_idr) values(m.workspace_id,par,cat.id,amount) on conflict(workspace_id,trip_id,category_id) do update set amount_idr=excluded.amount_idr,version=public.trip_budgets.version+1,updated_at=now();r:=par;
 elsif a in ('create_transaction','edit_transaction','void_transaction','approve_correction','reject_correction') then
  if not private.allowed(m.workspace_id,'finance',case when a in ('approve_correction','reject_correction','void_transaction') then false else true end) then raise exception 'Akses Finance ditolak' using errcode='42501';end if;
  if a in ('approve_correction','reject_correction','void_transaction') and m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
  if a in ('approve_correction','reject_correction') then
   select * into cr from public.transaction_corrections where id=i and workspace_id=m.workspace_id for update;
   if cr.id is null or cr.status<>'pending' then raise exception 'Koreksi tidak tersedia';end if;
   if cr.version is distinct from v then raise exception 'Koreksi berubah. Reload.' using errcode='40001';end if;
   select * into tx from public.transactions where id=cr.transaction_id and workspace_id=m.workspace_id for update;
   if a='approve_correction' then
    if tx.version<>cr.transaction_version or tx.data->>'status'<>'posted' then raise exception 'Transaksi berubah; tolak dan ajukan ulang koreksi' using errcode='40001';end if;
    if not exists(select 1 from public.finance_categories where id=cr.proposed->>'category' and direction=cr.proposed->>'direction' and (active or id=tx.category_id)) then raise exception 'Kategori tidak aktif';end if;
    before_data:=tx.data;nd:=cr.proposed||jsonb_build_object('confirmed_by',m.id,'confirmed_at',now());
    update public.transactions set data=nd,trip=nullif(nd->>'trip','')::uuid,amount_idr=(nd->>'amount')::numeric,transaction_date=(nd->>'date')::date,direction=nd->>'direction',category_id=nd->>'category',version=version+1,updated_at=now() where id=tx.id;
   else before_data:=cr.proposed;nd:=tx.data;end if;
   reason:=coalesce(d->>'reason','');update public.transaction_corrections set status=case a when 'approve_correction' then 'approved' else 'rejected' end,reviewed_by=m.id,reviewed_at=now(),review_reason=coalesce(d->>'reason',''),version=version+1,updated_at=now() where id=i;r:=tx.id;
  else
   if a<>'create_transaction' then
    select * into tx from public.transactions where id=i and workspace_id=m.workspace_id for update;
    if tx.id is null then raise exception 'Transaksi tidak ditemukan';end if;
    if tx.version is distinct from v then raise exception 'Transaksi berubah. Reload.' using errcode='40001';end if;
    if tx.data->>'status'<>'posted' then raise exception 'Void final';end if;
    reason:=trim(d->>'reason');if coalesce(length(reason),0) not between 1 and 5000 then raise exception 'Alasan wajib';end if;before_data:=tx.data;
   end if;
   if a='void_transaction' then
    nd:=tx.data||jsonb_build_object('status','void','void_by',m.id,'void_at',now(),'reason',reason);
    update public.transactions set data=nd,version=version+1,updated_at=now() where id=i;
    update public.transaction_corrections set status='rejected',reviewed_by=m.id,reviewed_at=now(),review_reason='Transaksi void',version=version+1,updated_at=now() where transaction_id=i and status='pending';r:=i;
   else
    perform private.assert_money(d->>'amount');perform private.assert_date(d->>'date',true);amount:=(d->>'amount')::numeric;par:=nullif(d->>'trip','')::uuid;
    if par is not null and not exists(select 1 from public.journeys where id=par and workspace_id=m.workspace_id and kind='trip') then raise exception 'Trip tidak valid';end if;
    select * into cat from public.finance_categories where id=d->>'category' and direction=d->>'direction' and (active or (a='edit_transaction' and id=tx.category_id));if cat.id is null then raise exception 'Kategori tidak valid';end if;
    if (d->>'date')::date>(now() at time zone private.ui_timezone(c->>'timezone'))::date then raise exception 'Tanggal transaksi di masa depan';end if;
    if coalesce(length(trim(d->>'title')),0) not between 1 and 200 or length(coalesce(d->>'description',''))>5000 then raise exception 'Judul / catatan tidak valid';end if;
    if a='create_transaction' then key:=(d->>'idempotency_key')::uuid;if key is null then raise exception 'Idempotency key wajib';end if;else key:=tx.idempotency_key;end if;
    nd:=jsonb_build_object('title',trim(d->>'title'),'date',d->>'date','direction',d->>'direction','amount',private.money_text(amount),'category',cat.id,'trip',par,'description',coalesce(d->>'description',''),'status','posted','created_by',case when a='create_transaction' then m.id else (tx.data->>'created_by')::uuid end,'void_by',null,'void_at',null,'reason',coalesce(reason,''),'idempotency_key',key);
    if a='create_transaction' then
     select * into tx from public.transactions where workspace_id=m.workspace_id and idempotency_key=key;
     if tx.id is not null then
      if (tx.data-array['confirmed_by','confirmed_at']) is distinct from nd then raise exception 'Idempotency key sudah tersimpan dengan data berbeda' using errcode='40001';end if;return tx.id;
     end if;
     r:=gen_random_uuid();insert into public.transactions(id,workspace_id,data,trip,amount_idr,transaction_date,direction,category_id,idempotency_key) values(r,m.workspace_id,nd,par,amount,(d->>'date')::date,d->>'direction',cat.id,key);
    else
     if exists(select 1 from public.transaction_corrections where transaction_id=i and status='pending') then raise exception 'Transaksi memiliki koreksi yang menunggu admin';end if;
     insert into public.transaction_corrections(workspace_id,transaction_id,transaction_version,proposed,original,reason,requested_by) values(m.workspace_id,i,tx.version,nd,tx.data,reason,m.id);r:=i;
    end if;
   end if;
  end if;
 else
  -- Complete/cancel archives trip and cancels only unfinished tasks atomically.
  if a='archive' then select * into j from public.journeys where id=i and workspace_id=m.workspace_id;
   if j.kind='trip' then
    if d->>'outcome' in ('completed','cancelled') then c:=jsonb_build_object('action','stage','id',i,'version',v,'timezone',c->>'timezone','data',jsonb_build_object('stage',case d->>'outcome' when 'completed' then 'Completed' else 'Cancelled' end));
    else c:=jsonb_set(c,'{data}',d||jsonb_build_object('lost',false));end if;
   end if;
  end if;
  if a='save_template' and i is not null then
   select * into tpl from public.templates where id=i and workspace_id=m.workspace_id;
   if tpl.id is null or not private.allowed(m.workspace_id,case tpl.kind when 'lead_note' then 'sales' when 'internal_doc' then 'docs' else 'trips' end,true) then raise exception 'Akses template ditolak' using errcode='42501';end if;
  end if;
  r:=private.command_before_refinements(c);
  if a in ('stage','update_journey','archive') then
   select * into j from public.journeys where id=r and workspace_id=m.workspace_id;
   if j.kind='trip' and j.data->>'lifecycle'='archived' then update public.tasks set data=data||jsonb_build_object('cancelled_at',now()),version=version+1,updated_at=now() where parent=j.id and data->>'status'<>'Done' and data->>'cancelled_at' is null;end if;
  end if;
  return r;
 end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,a,r::text,jsonb_build_object('before',before_data,'after',nd,'reason',reason,'correction',cr.id));return r;
end$$;

alter function private.snapshot(text,jsonb,uuid) rename to snapshot_before_refinements;
create function private.snapshot(view_name text,filters jsonb,record_id uuid default null) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$declare m public.memberships;s jsonb;ds jsonb;cnt integer;begin
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 if view_name in ('home','trips','finance') and private.allowed(m.workspace_id,'trips') then perform private.advance_trips(m.workspace_id);end if;
 if view_name='docs' then
  if not private.allowed(m.workspace_id,'docs') then raise exception 'Akses Docs ditolak' using errcode='42501';end if;
  if record_id is not null and not exists(select 1 from public.internal_docs where id=record_id and workspace_id=m.workspace_id) then raise exception 'Dokumen tidak ditemukan' using errcode='42501';end if;
  s:=private.snapshot_before_refinements('home','{}',null);
  select count(*) into cnt from public.internal_docs x where workspace_id=m.workspace_id and (record_id is null or id=record_id) and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower(title||' '||category))>0) and (coalesce(filters->>'category','')='' or category=filters->>'category');
  select coalesce(jsonb_agg(d order by d->>'date' desc,d->>'created_at' desc),'[]') into ds from (select case when record_id is null then to_jsonb(x)-array['workspace_id','body'] else to_jsonb(x)-'workspace_id' end d from public.internal_docs x where workspace_id=m.workspace_id and (record_id is null or id=record_id) and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower(title||' '||category))>0) and (coalesce(filters->>'category','')='' or category=filters->>'category') order by date desc,created_at desc limit 50 offset case when record_id is not null then 0 else greatest(0,coalesce((filters->>'page')::integer,0))*50 end) q;
  s:=s||jsonb_build_object('documents',ds,'count',cnt,'tasks','[]'::jsonb,'taskCounts','{}'::jsonb,'journeys','[]'::jsonb);
 else s:=private.snapshot_before_refinements(view_name,filters,record_id);end if;
 if private.allowed(m.workspace_id,'finance') and (view_name='finance' or (view_name='trips' and record_id is not null)) then
  s:=s||jsonb_build_object('corrections',(select coalesce(jsonb_agg(to_jsonb(cr)-'workspace_id' order by created_at),'[]') from public.transaction_corrections cr where workspace_id=m.workspace_id and status='pending' and (view_name='finance' or cr.proposed->>'trip'=record_id::text or exists(select 1 from public.transactions t where t.id=cr.transaction_id and t.trip=record_id))));
 end if;
 -- Configuration and audit are scoped by module privileges, including for admins.
 s:=s||jsonb_build_object('templates',(select coalesce(jsonb_agg(to_jsonb(t)-'workspace_id' order by name),'[]') from public.templates t where workspace_id=m.workspace_id and private.allowed(m.workspace_id,case t.kind when 'lead_note' then 'sales' when 'internal_doc' then 'docs' else 'trips' end)));
 if not private.allowed(m.workspace_id,'sales') then s:=s-'salesStages';end if;
 if not private.allowed(m.workspace_id,'trips') then s:=s-'tripStages';end if;
 if view_name='audit' then
  with events as (select e.* from private.audit_events e where workspace_id=m.workspace_id
   and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower(action||' '||entity))>0)
   and (coalesce(filters->>'actor','')='' or actor::text=filters->>'actor') and (coalesce(filters->>'action','')='' or action=filters->>'action')
   and (coalesce(filters->>'from','')='' or at>=((filters->>'from')::date::timestamp at time zone private.ui_timezone(filters->>'timezone')))
   and (coalesce(filters->>'to','')='' or at<(((filters->>'to')::date+1)::timestamp at time zone private.ui_timezone(filters->>'timezone')))
   and ((private.allowed(m.workspace_id,'finance') and (action like '%transaction%' or action like '%correction%' or action in ('save_budget','save_category','csv_export')))
    or (private.allowed(m.workspace_id,'sales') and (action in ('save_stage','retire_stage') or (action in ('create_journey','update_journey','content','stage','archive','restore','convert','journey_changes','apply_template') and exists(select 1 from public.journeys where id::text=e.entity and workspace_id=m.workspace_id and kind='lead'))))
    or (private.allowed(m.workspace_id,'trips') and action in ('create_journey','update_journey','content','stage','archive','journey_changes','trip_auto_progress','apply_template') and exists(select 1 from public.journeys where id::text=e.entity and workspace_id=m.workspace_id and kind='trip'))
    or (action in ('create_task','task_status','update_task','cancel_task') and exists(select 1 from public.tasks t where t.workspace_id=m.workspace_id and t.id::text=e.entity and (t.assignee=m.id or private.parent_allowed(t.parent) or m.role='admin')))
    or (private.allowed(m.workspace_id,'docs') and (action in ('create_doc','update_doc') or action like 'doc_share_%'))
    or (action in ('save_template','apply_template') and exists(select 1 from public.templates t where t.workspace_id=m.workspace_id and (t.id::text=e.entity or t.id::text=e.metadata->>'template') and private.allowed(m.workspace_id,case t.kind when 'lead_note' then 'sales' when 'internal_doc' then 'docs' else 'trips' end)))
    or (m.role='admin' and action in ('invite','resend_invite','revoke_invite','update_person','deactivate'))))
  select s||jsonb_build_object('audit',(select coalesce(jsonb_agg(to_jsonb(x)-'workspace_id' order by at desc,id),'[]') from (select * from events order by at desc,id limit 50 offset greatest(0,coalesce((filters->>'page')::integer,0))*50) x),'count',(select count(*) from events)) into s;
 end if;return s;
end$$;

-- Public doc links contain a deliberate read-only snapshot, with expiry/revocation.
create table private.doc_share_links(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,doc_id uuid not null,token_hash text not null unique,payload jsonb not null,expires_at timestamptz not null,revoked_at timestamptz,created_by uuid not null,version integer not null default 1,foreign key(doc_id,workspace_id) references public.internal_docs(id,workspace_id));
alter table private.doc_share_links enable row level security;
revoke all on private.doc_share_links from public,anon,authenticated;
create function private.doc_share_manage(action_name text,doc_id uuid,link_id uuid,expected_version integer,raw_token text,expiry_days integer) returns jsonb language plpgsql security definer set search_path='' as $$declare m public.memberships;d public.internal_docs;l private.doc_share_links;share_payload_data jsonb;begin
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses Docs edit wajib' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;select fresh_member.* into m from public.memberships fresh_member where fresh_member.id=auth.uid() and fresh_member.status='active';if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses ditolak' using errcode='42501';end if;
 select * into d from public.internal_docs where id=doc_id and workspace_id=m.workspace_id;if d.id is null then raise exception 'Dokumen tidak ditemukan';end if;
 if action_name='list' then return jsonb_build_object('enabled',true,'links',(select coalesce(jsonb_agg(to_jsonb(x)-array['token_hash','payload','workspace_id','created_by']),'[]') from private.doc_share_links x where x.doc_id=d.id and x.workspace_id=m.workspace_id));end if;
 share_payload_data:=jsonb_build_object('kind','internal_doc','title',d.title,'notes',jsonb_build_array(jsonb_build_object('title','','body',d.body)),'contacts','[]'::jsonb);
 if action_name='preview' then return share_payload_data;end if;
 if expected_version is distinct from d.version then raise exception 'Dokumen berubah; reload preview' using errcode='40001';end if;
 if action_name not in ('create','publish','regenerate','revoke') then raise exception 'Action tidak valid';end if;
 if link_id is not null then select * into l from private.doc_share_links where id=link_id and workspace_id=m.workspace_id and private.doc_share_links.doc_id=d.id for update;if l.id is null then raise exception 'Link tidak ditemukan';end if;end if;
 if action_name in ('create','regenerate') then
  if raw_token is null or raw_token !~ '^[a-f0-9]{64}$' or expiry_days is null or expiry_days not between 1 and 30 then raise exception 'Token / expiry tidak valid';end if;
  if action_name='regenerate' then if l.id is null then raise exception 'Pilih link';end if;update private.doc_share_links set revoked_at=now(),version=version+1 where id=l.id;end if;
  insert into private.doc_share_links(workspace_id,doc_id,token_hash,payload,expires_at,created_by) values(m.workspace_id,d.id,encode(sha256(convert_to(raw_token,'UTF8')),'hex'),share_payload_data,now()+make_interval(days=>expiry_days),m.id) returning * into l;
 elsif action_name='revoke' then if l.id is null then raise exception 'Pilih link';end if;update private.doc_share_links set revoked_at=now(),version=version+1 where id=l.id;
 else if l.id is null or l.revoked_at is not null or l.expires_at<=now() then raise exception 'Link unavailable';end if;update private.doc_share_links set payload=share_payload_data,version=version+1 where id=l.id;end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'doc_share_'||action_name,d.id::text,jsonb_build_object('link',l.id,'permission','view'));
 return jsonb_build_object('id',l.id,'expires_at',l.expires_at);
end$$;
create function public.app_doc_share_manage(action_name text,doc_id uuid,link_id uuid default null,expected_version integer default null,raw_token text default null,expiry_days integer default 7) returns jsonb language sql security invoker set search_path='' as $$select private.doc_share_manage(action_name,doc_id,link_id,expected_version,raw_token,expiry_days)$$;
alter function private.share_read(text) rename to share_read_trip;
create function private.share_read(raw_token text) returns jsonb language plpgsql security definer set search_path='' as $$declare payload jsonb;hits integer;begin
 payload:=private.share_read_trip(raw_token);if payload is not null then return payload;end if;
 select r.hits into hits from private.share_rate r where bucket='global';
 if hits>300 or raw_token is null or raw_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select l.payload into payload from private.doc_share_links l where token_hash=encode(sha256(convert_to(raw_token,'UTF8')),'hex') and revoked_at is null and expires_at>now();return payload;
end$$;
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql volatile security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
create or replace function public.app_share_read(raw_token text) returns jsonb language sql security invoker set search_path='' as $$select private.share_read(raw_token)$$;
revoke all on function private.money_text(numeric),private.trip_lifecycle(),private.advance_trips(uuid),private.command_before_refinements(jsonb),private.snapshot_before_refinements(text,jsonb,uuid),private.command(jsonb),private.snapshot(text,jsonb,uuid),private.doc_share_manage(text,uuid,uuid,integer,text,integer),public.app_doc_share_manage(text,uuid,uuid,integer,text,integer),private.share_read_trip(text),private.share_read(text) from public,anon,authenticated;
grant execute on function private.command(jsonb),private.snapshot(text,jsonb,uuid),private.doc_share_manage(text,uuid,uuid,integer,text,integer),public.app_doc_share_manage(text,uuid,uuid,integer,text,integer) to authenticated;
grant execute on function private.share_read(text) to anon,authenticated;
notify pgrst,'reload schema';
create or replace function private.budget_rows(w uuid,trip uuid default null) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('trip',j.id,'name',j.data->>'name','lifecycle',j.data->>'lifecycle','category',cat.id,'label',cat.name,'direction',cat.direction,'active',cat.active,'budget',private.money_text(b.amount_idr),'version',b.version,'actual',(select private.money_text(coalesce(sum(t.amount_idr),0)) from public.transactions t where t.workspace_id=w and t.trip=j.id and t.category_id=cat.id and t.data->>'status'='posted')) order by j.data->>'name',cat.direction,cat.name),'[]') from public.journeys j cross join public.finance_categories cat left join public.trip_budgets b on b.workspace_id=w and b.trip_id=j.id and b.category_id=cat.id where j.workspace_id=w and j.kind='trip' and (trip is null or j.id=trip) and (cat.active or b.trip_id is not null or exists(select 1 from public.transactions t where t.workspace_id=w and t.trip=j.id and t.category_id=cat.id and t.data->>'status'='posted'));
$$;
