-- Validate direct bearer RPC calls as well as the application's API.
create or replace function private.check_task() returns trigger language plpgsql set search_path='' as $$declare k text;begin
 if new.parent is not null then select kind into k from public.journeys where id=new.parent and workspace_id=new.workspace_id;if k is distinct from new.data->>'context' then raise exception 'Task context tidak sesuai parent';end if;end if;
 if new.assignee is null then
  if new.parent is null or k is distinct from 'trip' or new.data->>'assignee' is distinct from 'public' then raise exception 'Public task hanya untuk Trip';end if;
 elsif (tg_op='INSERT' or new.assignee is distinct from old.assignee or new.parent is distinct from old.parent) and not private.eligible(new.workspace_id,new.assignee,case new.data->>'context' when 'lead' then 'sales' when 'trip' then 'trips' else null end) then raise exception 'Task assignee tidak eligible';end if;
 if coalesce(length(trim(new.data->>'title')),0) not between 1 and 200 or length(coalesce(new.data->>'description',''))>5000 then raise exception 'Task tidak valid';end if;
 perform private.assert_date(new.data->>'due');return new;
end$$;
create or replace function private.validate_shared_content(d jsonb) returns void language plpgsql set search_path='' as $$declare k text;x jsonb;y jsonb;ids uuid[]:='{}';n uuid;begin
 for k in select jsonb_object_keys(d) loop
  if k not in ('notes','days','contacts') or jsonb_typeof(d->k) is distinct from 'array' then raise exception 'Konten tidak valid';end if;
  if (k='notes' and jsonb_array_length(d->k)>30) or (k='contacts' and jsonb_array_length(d->k)>100) or (k='days' and jsonb_array_length(d->k) not between 1 and 90) then raise exception 'Konten terlalu banyak';end if;
  for x in select jsonb_array_elements(d->k) loop
   n:=(x->>'id')::uuid;if n is null or n=any(ids) then raise exception 'ID konten duplikat / kosong';end if;ids:=array_append(ids,n);
   if k='notes' then
    if jsonb_typeof(x->'title') is distinct from 'string' or length(trim(x->>'title')) not between 1 and 120 or jsonb_typeof(x->'body') is distinct from 'string' or length(x->>'body')>50000 then raise exception 'Note tidak valid';end if;
   elsif k='contacts' then
    if jsonb_typeof(x->'name') is distinct from 'string' or length(trim(x->>'name')) not between 1 and 200 or jsonb_typeof(x->'phone') is distinct from 'string' or length(x->>'phone')>80 or jsonb_typeof(x->'email') is distinct from 'string' or length(x->>'email')>254 or (x->>'email'<>'' and x->>'email' !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') or jsonb_typeof(x->'note') is distinct from 'string' or length(x->>'note')>5000 then raise exception 'Contact tidak valid';end if;
   else
    if jsonb_typeof(x->'title') is distinct from 'string' or length(x->>'title')>200 or jsonb_typeof(x->'items') is distinct from 'array' or jsonb_array_length(x->'items')>100 then raise exception 'Day tidak valid';end if;
    for y in select jsonb_array_elements(x->'items') loop
     n:=(y->>'id')::uuid;if n is null or n=any(ids) then raise exception 'ID konten duplikat / kosong';end if;ids:=array_append(ids,n);
     if jsonb_typeof(y->'name') is distinct from 'string' or length(trim(y->>'name')) not between 1 and 200 or jsonb_typeof(y->'description') is distinct from 'string' or length(y->>'description')>10000 then raise exception 'Aktivitas tidak valid';end if;
    end loop;
   end if;
  end loop;
 end loop;
end$$;
create or replace function private.trip_public_command(token text,c jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare l private.trip_access_links;j public.journeys;t public.tasks;x private.trip_submissions;a text:=c->>'action';d jsonb:=coalesce(c->'data','{}');tab text;nd jsonb;r uuid;v integer:=(c->>'version')::integer;begin
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
  if a='content' then perform private.validate_shared_content(d);end if;
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
revoke all on function private.validate_shared_content(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
