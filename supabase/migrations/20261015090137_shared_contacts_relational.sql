-- One canonical contact per workspace; journeys hold ordered references only.
create table public.contacts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 name text not null check(length(trim(name)) between 1 and 200),
 name_key text generated always as (lower(regexp_replace(trim(name),'[[:space:]]+',' ','g'))) stored,
 phone text not null default '' check(length(phone)<=80),
 email text not null default '' check(length(email)<=254 and (email='' or email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')),
 role text not null default '' check(length(role)<=200),
 organization text not null default '' check(length(organization)<=200),
 note text not null default '' check(length(note)<=5000),
 internal_saved boolean not null default false,
 version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,name_key)
);
create table public.journey_contacts (
 workspace_id uuid not null,
 journey_id uuid not null,
 contact_id uuid not null,
 position integer not null check(position>=0),
 primary key(workspace_id,journey_id,contact_id),
 foreign key(workspace_id,journey_id) references public.journeys(workspace_id,id) on delete cascade,
 foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id) on delete cascade
);
create index journey_contacts_contact on public.journey_contacts(workspace_id,contact_id);
create table private.contact_directory_state (
 workspace_id uuid primary key references public.workspaces(id), version integer not null default 1
);
alter table public.contacts enable row level security;
alter table public.journey_contacts enable row level security;
alter table private.contact_directory_state enable row level security;
revoke all on public.contacts,public.journey_contacts,private.contact_directory_state from public,anon,authenticated;

-- Preserve other workspaces during the structural migration. The requested demo
-- reset is a separate, explicitly scoped transaction in supabase/reset-contacts.sql.
insert into private.contact_directory_state select workspace_id,version from private.internal_contacts;
with occurrences as (
 select j.workspace_id,c,j.updated_at at from public.journeys j cross join lateral jsonb_array_elements(j.data->'contacts') c
 union all select i.workspace_id,c,'1970-01-01'::timestamptz from private.internal_contacts i cross join lateral jsonb_array_elements(i.contacts) c
), grouped as (
 select workspace_id,lower(regexp_replace(trim(c->>'name'),'[[:space:]]+',' ','g')) key,
 (array_agg(c order by at desc,c->>'id'))[1] c from occurrences group by 1,2
)
insert into public.contacts(workspace_id,name,phone,email,role,organization,note,internal_saved)
 select g.workspace_id,c->>'name',c->>'phone',c->>'email',c->>'role',c->>'organization',c->>'note',
 exists(select 1 from private.internal_contacts i cross join lateral jsonb_array_elements(i.contacts) x where i.workspace_id=g.workspace_id and lower(regexp_replace(trim(x->>'name'),'[[:space:]]+',' ','g'))=g.key)
 from grouped g;
insert into public.journey_contacts(workspace_id,journey_id,contact_id,position)
 select j.workspace_id,j.id,c.id,min(p)::integer-1 from public.journeys j
 cross join lateral jsonb_array_elements(j.data->'contacts') with ordinality x(d,p)
 join public.contacts c on c.workspace_id=j.workspace_id and c.name_key=lower(regexp_replace(trim(d->>'name'),'[[:space:]]+',' ','g')) group by 1,2,3;
update public.journeys set data=jsonb_set(data,'{contacts}','[]'),version=version+1,updated_at=now() where data->'contacts'<>'[]'::jsonb;
alter table public.journeys add constraint contacts_are_relational check(data->'contacts'='[]'::jsonb);
drop table private.internal_contacts;

create function private.contact_json(c public.contacts) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'email',c.email,'role',c.role,'organization',c.organization,'note',c.note,'version',c.version)
$$;
-- Private compatibility projection for older snapshot layers, never a second store.
create view private.internal_contacts with (security_invoker=true) as
 select w.id workspace_id,coalesce((select jsonb_agg(private.contact_json(c) order by c.name_key,c.id) from public.contacts c where c.workspace_id=w.id and c.internal_saved),'[]') contacts,
 coalesce(s.version,1) version from public.workspaces w left join private.contact_directory_state s on s.workspace_id=w.id;
revoke all on private.internal_contacts from public,anon,authenticated;

create function private.contact_visible(w uuid,i uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.allowed(w,'docs') or exists(select 1 from public.journey_contacts r where r.workspace_id=w and r.contact_id=i and private.parent_allowed(r.journey_id))
$$;
create policy contacts_read on public.contacts for select to authenticated using(private.contact_visible(workspace_id,id));
create policy journey_contacts_read on public.journey_contacts for select to authenticated using(private.parent_allowed(journey_id));
grant select on public.contacts,public.journey_contacts to authenticated;

create function private.journey_contact_list(i uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(private.contact_json(c) order by r.position,c.id),'[]') from public.journey_contacts r
 join public.contacts c on c.workspace_id=r.workspace_id and c.id=r.contact_id where r.journey_id=i
$$;
create or replace function private.contact_directory(w uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(private.contact_json(c)||jsonb_build_object('sources',s.sources,'source',(select string_agg(x->>'label',', ') from jsonb_array_elements(s.sources) x),'source_id',s.sources->0->'id','source_kind',s.sources->0->>'kind') order by c.name_key,c.id),'[]')
 from public.contacts c cross join lateral (
 select coalesce(jsonb_agg(source order by at desc,id),'[{"label":"Internal","id":null,"kind":"internal"}]') sources from (
 select jsonb_build_object('label',case j.kind when 'lead' then 'CRM' else 'Trip' end||' · '||coalesce(nullif(j.data->>'name',''),j.data->>'client'),'id',j.id,'kind',j.kind) source,j.updated_at at,j.id
 from public.journey_contacts r join public.journeys j on j.id=r.journey_id and j.workspace_id=r.workspace_id
 where r.workspace_id=w and r.contact_id=c.id and private.parent_allowed(j.id) order by j.updated_at desc,j.id limit 5
 ) recent) s where c.workspace_id=w and private.contact_visible(w,c.id)
$$;

-- A shared edit invalidates every open parent editor. Snapshot shares stay frozen.
create function private.contact_changed() returns trigger language plpgsql set search_path='' as $$
begin
 update public.journeys j set version=version+1,updated_at=now() where j.workspace_id=old.workspace_id and exists(select 1 from public.journey_contacts r where r.workspace_id=j.workspace_id and r.journey_id=j.id and r.contact_id=old.id);
 if old.internal_saved or (tg_op='UPDATE' and new.internal_saved) then
  insert into private.contact_directory_state(workspace_id,version) values(old.workspace_id,2) on conflict(workspace_id) do update set version=private.contact_directory_state.version+1;
 end if;
 return null;
end$$;
create trigger contact_changed after update or delete on public.contacts for each row execute function private.contact_changed();

create function private.validate_contact(d jsonb) returns void language plpgsql set search_path='' as $$
begin
 perform private.validate_shared_content(jsonb_build_object('contacts',jsonb_build_array(d)));
 if exists(select 1 from unnest(array['role','organization']) k where jsonb_typeof(d->k) is distinct from 'string' or length(d->>k)>200) then raise exception 'Field contact tidak valid';end if;
 if exists(select 1 from jsonb_object_keys(d) k where k not in ('id','name','phone','email','note','role','organization','version')) then raise exception 'Field contact tidak valid';end if;
end$$;
create function private.store_contact(w uuid,d jsonb,parent uuid default null,public_write boolean default false) returns uuid language plpgsql set search_path='' as $$
declare old public.contacts;next_data jsonb;begin
 perform private.validate_contact(d);
 select * into old from public.contacts where id=(d->>'id')::uuid;
 if old.id is not null and old.workspace_id<>w then raise exception 'Contact tidak tersedia' using errcode='42501';end if;
 if old.id is null then select * into old from public.contacts where workspace_id=w and name_key=lower(regexp_replace(trim(d->>'name'),'[[:space:]]+',' ','g'));end if;
 if old.id is not null then
  if public_write then
   if not exists(select 1 from public.journey_contacts where workspace_id=w and journey_id=parent and contact_id=old.id) then raise exception 'Contact tidak tersedia' using errcode='42501';end if;
  elsif not private.contact_visible(w,old.id) then raise exception 'Contact tidak tersedia' using errcode='42501';end if;
  next_data:=(d-array['id','version']);
  if (private.contact_json(old)-array['id','version']) is distinct from next_data then
   if public_write and (old.internal_saved or exists(select 1 from public.journey_contacts where workspace_id=w and contact_id=old.id and journey_id<>parent)) then raise exception 'Kontak bersama hanya dapat diedit melalui Internal' using errcode='42501';end if;
   if not public_write and not private.allowed(w,'docs',true) then raise exception 'Edit kontak bersama memerlukan Internal edit' using errcode='42501';end if;
   if old.version is distinct from (d->>'version')::integer then raise exception 'Contact berubah; reload dulu' using errcode='40001';end if;
   update public.contacts set name=trim(d->>'name'),phone=d->>'phone',email=d->>'email',role=d->>'role',organization=d->>'organization',note=d->>'note',version=version+1,updated_at=now() where id=old.id;
   insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(w,coalesce(auth.uid(),(select created_by from private.trip_access_links where trip_id=parent limit 1)),'edit_contact',old.id::text,jsonb_build_object('before',private.contact_json(old),'after',d));
  end if;
  return old.id;
 end if;
 insert into public.contacts(id,workspace_id,name,phone,email,role,organization,note) values((d->>'id')::uuid,w,trim(d->>'name'),d->>'phone',d->>'email',d->>'role',d->>'organization',d->>'note');
 return (d->>'id')::uuid;
end$$;
create function private.replace_journey_contacts(w uuid,j uuid,items jsonb,public_write boolean default false) returns void language plpgsql set search_path='' as $$
declare x jsonb;ids uuid[]:='{}';r uuid;p integer:=0;begin
 perform private.validate_shared_content(jsonb_build_object('contacts',items));
 for x in select value from jsonb_array_elements(items) loop
  r:=private.store_contact(w,x,j,public_write);
  if r=any(ids) then raise exception 'Contact duplikat';end if;ids:=array_append(ids,r);
 end loop;
 delete from public.journey_contacts where workspace_id=w and journey_id=j;
 foreach r in array ids loop
  insert into public.journey_contacts(workspace_id,journey_id,contact_id,position) values(w,j,r,p);p:=p+1;
 end loop;
end$$;

alter function private.command(jsonb) rename to command_before_relational_contacts;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships;a text:=c->>'action';d jsonb:=c->'data';j public.journeys;old public.contacts;x jsonb;r uuid;v integer;ids uuid[]:='{}';
begin
 if a not in ('content','convert','save_internal_contacts','edit_contact','delete_contacts') then return private.command_before_relational_contacts(c);end if;
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 if a='content' then
  if not d ? 'contacts' then return private.command_before_relational_contacts(c);end if;
  -- Delegate parent permissions, lifecycle, document checks and optimistic version.
  r:=private.command_before_relational_contacts(jsonb_set(c,'{data,contacts}','[]'));
  perform private.replace_journey_contacts(m.workspace_id,r,d->'contacts');
  insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'link_contacts',r::text,jsonb_build_object('contacts',(select jsonb_agg(contact_id) from public.journey_contacts where journey_id=r)));
  return r;
 elsif a='convert' then
  select * into j from public.journeys where id=(c->>'id')::uuid and workspace_id=m.workspace_id;
  r:=private.command_before_relational_contacts(c);
  if j.data->>'converted_trip' is null then
   insert into public.journey_contacts select workspace_id,r,contact_id,position from public.journey_contacts where workspace_id=m.workspace_id and journey_id=j.id;
  end if;return r;
 end if;
 if not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses Internal edit wajib' using errcode='42501';end if;
 if a='edit_contact' then
  select * into old from public.contacts where id=(c->>'id')::uuid and workspace_id=m.workspace_id for update;
  if old.id is null or d->'contact'->>'id' is distinct from c->>'id' then raise exception 'Contact tidak ditemukan' using errcode='42501';end if;
  if old.version is distinct from (c->>'version')::integer then raise exception 'Contact berubah; reload dulu' using errcode='40001';end if;
  return private.store_contact(m.workspace_id,(d->'contact')||jsonb_build_object('version',c->'version'));
 elsif a='delete_contacts' then
  if jsonb_typeof(d->'records') is distinct from 'array' or jsonb_array_length(d->'records') not between 1 and 100 then raise exception 'Records tidak valid';end if;
  for x in select value from jsonb_array_elements(d->'records') loop
   select * into old from public.contacts where workspace_id=m.workspace_id and id=(x->>'id')::uuid for update;
   if old.id is null then raise exception 'Contact tidak ditemukan' using errcode='42501';end if;
   if old.id=any(ids) then raise exception 'Records duplikat';end if;ids:=array_append(ids,old.id);
   if old.version is distinct from (x->>'version')::integer then raise exception 'Contact berubah; reload dulu' using errcode='40001';end if;
   insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'delete_contact',old.id::text,jsonb_build_object('before',private.contact_json(old)));
   -- BEFORE cascade removal, invalidate every linked document.
   update public.journeys q set version=version+1,updated_at=now() where exists(select 1 from public.journey_contacts z where z.journey_id=q.id and z.contact_id=old.id);
   delete from public.contacts where id=old.id;
  end loop;return m.workspace_id;
 else
  perform private.validate_shared_content(jsonb_build_object('contacts',d->'contacts'));
  insert into private.contact_directory_state(workspace_id) values(m.workspace_id) on conflict do nothing;
  select version into v from private.contact_directory_state where workspace_id=m.workspace_id for update;
  if v is distinct from (c->>'version')::integer then raise exception 'Contacts berubah; reload dulu' using errcode='40001';end if;
  for x in select value from jsonb_array_elements(d->'contacts') loop
   r:=private.store_contact(m.workspace_id,x);
   if r=any(ids) then raise exception 'Contact duplikat';end if;ids:=array_append(ids,r);
   update public.contacts set internal_saved=true where id=r and not internal_saved;
  end loop;
  update public.contacts set internal_saved=false where workspace_id=m.workspace_id and internal_saved and id<>all(ids);
  update private.contact_directory_state set version=v+1 where workspace_id=m.workspace_id;
  insert into private.audit_events(workspace_id,actor,action,entity) values(m.workspace_id,m.id,'save_internal_contacts',m.workspace_id::text);
  return m.workspace_id;
 end if;
end$$;

alter function private.snapshot(text,jsonb,uuid) rename to snapshot_before_relational_contacts;
create function private.snapshot(v text,f jsonb,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;begin
 s:=private.snapshot_before_relational_contacts(v,f,i);
 if v in ('sales','trips') and i is not null then
  s:=jsonb_set(s,'{journeys}',(select coalesce(jsonb_agg(j||jsonb_build_object('contacts',private.journey_contact_list((j->>'id')::uuid))),'[]') from jsonb_array_elements(s->'journeys') j));
 end if;return s;
end$$;

-- Existing sharing functions keep their allowlists and token checks. Change only
-- their data source; fail on schema drift instead of silently leaving stale reads.
do $$declare sig text;definition text;begin
 foreach sig in array array['private.share_payload(uuid,jsonb)','private.trip_public_read(text)'] loop
  definition:=pg_get_functiondef(sig::regprocedure);
  if position('j.data->''contacts''' in definition)=0 then raise exception 'Contact reader drift: %',sig;end if;
  execute replace(definition,'j.data->''contacts''','private.journey_contact_list(j.id)');
 end loop;
end$$;
alter function private.trip_public_command(text,jsonb) rename to trip_public_command_before_relational_contacts;
create function private.trip_public_command(token text,c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare l private.trip_access_links;j public.journeys;x jsonb;clean jsonb:='[]';old public.contacts;w uuid;begin
 if c->>'action'<>'content' or not (c->'data' ? 'contacts') then return private.trip_public_command_before_relational_contacts(token,c);end if;
 select workspace_id into w from private.trip_access_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if w is null then raise exception 'Link tidak tersedia' using errcode='42501';end if;
 perform 1 from public.workspaces where id=w for update;
 -- Verify the bearer capability after taking the internal editor's workspace lock.
 l:=private.trip_access(token);
 select * into j from public.journeys where id=l.trip_id and workspace_id=l.workspace_id for update;
 if l.permissions->>'contacts' is distinct from 'edit' or c->>'id' is distinct from j.id::text or j.data->>'lifecycle'<>'active' then raise exception 'Akses kontak ditolak' using errcode='42501';end if;
 if j.version is distinct from (c->>'version')::integer then raise exception 'Data berubah. Refresh sebelum menyimpan.' using errcode='40001';end if;
 if exists(select 1 from jsonb_object_keys(c->'data') k where k<>'contacts') then raise exception 'Field tidak diizinkan' using errcode='42501';end if;
 perform private.validate_shared_content(c->'data');
 for x in select value from jsonb_array_elements(c->'data'->'contacts') loop
  select ct.* into old from public.contacts ct join public.journey_contacts r on r.workspace_id=ct.workspace_id and r.contact_id=ct.id where r.workspace_id=l.workspace_id and r.journey_id=j.id and ct.id=(x->>'id')::uuid;
  clean:=clean||jsonb_build_array(x||jsonb_build_object('role',coalesce(old.role,''),'organization',coalesce(old.organization,''),'version',old.version));
 end loop;
 perform private.replace_journey_contacts(l.workspace_id,j.id,clean,true);
 update public.journeys set version=version+1,updated_at=now() where id=j.id;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(l.workspace_id,l.created_by,'public_content',j.id::text,jsonb_build_object('origin','public','link',l.id));
 return j.id;
end$$;

-- Rebind public entry points after renaming their implementation functions.
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
create or replace function public.app_trip_public_command(raw_token text,command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.trip_public_command(raw_token,command)$$;
revoke all on function private.contact_json(public.contacts),private.contact_visible(uuid,uuid),private.journey_contact_list(uuid),private.contact_changed(),private.validate_contact(jsonb),private.store_contact(uuid,jsonb,uuid,boolean),private.replace_journey_contacts(uuid,uuid,jsonb,boolean),private.command_before_relational_contacts(jsonb),private.command(jsonb),private.snapshot_before_relational_contacts(text,jsonb,uuid),private.snapshot(text,jsonb,uuid),private.trip_public_command_before_relational_contacts(text,jsonb),private.trip_public_command(text,jsonb) from public,anon,authenticated;
grant execute on function private.contact_visible(uuid,uuid),private.command(jsonb),private.snapshot(text,jsonb,uuid) to authenticated;
grant execute on function private.trip_public_command(text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
