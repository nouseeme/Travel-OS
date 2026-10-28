-- Recoverable share capabilities remain in private tables, behind existing editor authorization.
-- Keep finance submissions and audit events when removing their access link.
alter table private.trip_submissions alter column link_id drop not null;
alter table private.trip_submissions drop constraint trip_submissions_link_id_fkey;
alter table private.trip_submissions add constraint trip_submissions_link_id_fkey foreign key(link_id) references private.trip_access_links(id) on delete set null;
alter table private.share_snapshots drop constraint share_snapshots_share_link_id_fkey;
alter table private.share_snapshots add constraint share_snapshots_share_link_id_fkey foreign key(share_link_id) references private.share_links(id) on delete cascade;
alter table private.share_links add column share_token text not null default ('link-'||translate(rtrim(encode(decode(replace(gen_random_uuid()::text,'-',''),'hex'),'base64'),'='),'+/','-_')) unique;
alter table private.doc_share_links add column share_token text not null default ('link-'||translate(rtrim(encode(decode(replace(gen_random_uuid()::text,'-',''),'hex'),'base64'),'='),'+/','-_')) unique;
alter table private.contact_share_links add column share_token text not null default ('link-'||translate(rtrim(encode(decode(replace(gen_random_uuid()::text,'-',''),'hex'),'base64'),'='),'+/','-_')) unique;
alter table private.trip_access_links add column share_token text not null default ('link-'||translate(rtrim(encode(decode(replace(gen_random_uuid()::text,'-',''),'hex'),'base64'),'='),'+/','-_')) unique;

-- This trigger covers revoke, regenerate and document/contact deletion paths.
-- It never deletes business data; the submission FK above detaches provenance.
create function private.delete_revoked_share() returns trigger language plpgsql set search_path='' as $$begin
 if new.revoked_at is not null then
  execute format('delete from private.%I where id=$1',tg_table_name) using new.id;
 end if;
 return null;
end$$;
revoke all on function private.delete_revoked_share() from public,anon,authenticated;
create trigger delete_revoked_share after insert or update on private.share_links for each row execute function private.delete_revoked_share();
create trigger delete_revoked_share after insert or update on private.doc_share_links for each row execute function private.delete_revoked_share();
create trigger delete_revoked_share after insert or update on private.contact_share_links for each row execute function private.delete_revoked_share();
create trigger delete_revoked_share after insert or update on private.trip_access_links for each row execute function private.delete_revoked_share();

create or replace function private.share_manage(action_name text,trip_id uuid,link_id uuid,expected_version integer,selection jsonb,raw_token text,expiry_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.memberships;j public.journeys;l private.share_links;payload jsonb;enabled boolean;begin
 m:=private.me();if m.id is null or m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;m:=private.me();if m.id is null or m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
 select * into j from public.journeys where id=trip_id and workspace_id=m.workspace_id and kind='trip';if j.id is null then raise exception 'Trip tidak ditemukan';end if;
 if action_name='list' then return jsonb_build_object('enabled',(select sharing_enabled from public.workspaces where id=m.workspace_id),'links',(select coalesce(jsonb_agg(to_jsonb(x)-array['token_hash','workspace_id','created_by'] order by expires_at desc),'[]') from private.share_links x where x.trip_id=share_manage.trip_id and x.workspace_id=m.workspace_id));end if;
 payload:=private.share_payload(trip_id,selection);
 if action_name='preview' then return payload;end if;
 if action_name not in ('create','publish','regenerate','revoke') then raise exception 'Action tidak valid';end if;
 if expected_version is distinct from j.version then raise exception 'Trip berubah; periksa preview kembali.' using errcode='40001';end if;
 if action_name<>'revoke' and not (select sharing_enabled from public.workspaces where id=m.workspace_id) then raise exception 'Sharing security gate belum diaktifkan' using errcode='42501';end if;
 if link_id is not null then select * into l from private.share_links where id=link_id and workspace_id=m.workspace_id and private.share_links.trip_id=share_manage.trip_id for update;if l.id is null then raise exception 'Link tidak ditemukan';end if;end if;
 if action_name in ('create','regenerate') then
  if raw_token !~ '^[0-9a-f]{64}$' or expiry_days not between 1 and 30 then raise exception 'Token/expiry tidak valid';end if;
  if action_name='regenerate' then if l.id is null then raise exception 'Pilih link';end if;update private.share_links set revoked_at=now(),version=version+1 where id=l.id;end if;
  insert into private.share_links(workspace_id,trip_id,token_hash,expires_at,created_by) values(m.workspace_id,trip_id,encode(sha256(convert_to(raw_token,'UTF8')),'hex'),now()+make_interval(days=>expiry_days),m.id) returning * into l;
  insert into private.share_snapshots(share_link_id,payload) values(l.id,payload);
 elsif action_name='revoke' then if l.id is null then raise exception 'Pilih link';end if;update private.share_links set revoked_at=now(),version=version+1 where id=l.id;
 else
  if l.id is null or l.revoked_at is not null or l.expires_at<=now() then raise exception 'Link unavailable';end if;
  update private.share_snapshots set payload=private.share_payload(trip_id,selection),published_at=now() where share_link_id=l.id;
  update private.share_links set version=version+1 where id=l.id;
 end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'share_'||action_name,l.id::text,jsonb_build_object('trip',trip_id));
 return jsonb_build_object('id',l.id,'expires_at',l.expires_at);
end$$;


create or replace function private.doc_share_manage(action_name text,doc_id uuid,link_id uuid,expected_version integer,raw_token text,expiry_days integer) returns jsonb language plpgsql security definer set search_path='' as $$declare m public.memberships;d public.internal_docs;l private.doc_share_links;share_payload_data jsonb;begin
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses Docs edit wajib' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;select fresh_member.* into m from public.memberships fresh_member where fresh_member.id=auth.uid() and fresh_member.status='active';if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses ditolak' using errcode='42501';end if;
 select * into d from public.internal_docs where id=doc_id and workspace_id=m.workspace_id;if d.id is null then raise exception 'Dokumen tidak ditemukan';end if;
 if action_name='list' then return jsonb_build_object('enabled',true,'links',(select coalesce(jsonb_agg(to_jsonb(x)-array['token_hash','payload','workspace_id','created_by']),'[]') from private.doc_share_links x where x.doc_id=d.id and x.workspace_id=m.workspace_id and x.revoked_at is null));end if;
 share_payload_data:=jsonb_build_object('kind','internal_doc','title',d.title,'notes',jsonb_build_array(jsonb_build_object('title','','body',d.body)),'contacts','[]'::jsonb);
 if action_name='preview' then return share_payload_data;end if;
 if expected_version is distinct from d.version then raise exception 'Dokumen berubah; reload preview' using errcode='40001';end if;
 if action_name not in ('create','publish','regenerate','revoke') then raise exception 'Action tidak valid';end if;
 if link_id is not null then select * into l from private.doc_share_links where id=link_id and workspace_id=m.workspace_id and private.doc_share_links.doc_id=d.id for update;if l.id is null then raise exception 'Link tidak ditemukan';end if;end if;
 if action_name in ('create','regenerate') then
  if raw_token is null or raw_token !~ '^([a-f0-9]{64}|[a-z0-9][a-z0-9-]{0,19}-[A-Za-z0-9_-]{22})$' or expiry_days is null or expiry_days not between 1 and 30 then raise exception 'Token / expiry tidak valid';end if;
  if action_name='regenerate' then if l.id is null then raise exception 'Pilih link';end if;update private.doc_share_links set revoked_at=now(),version=version+1 where id=l.id;end if;
  insert into private.doc_share_links(workspace_id,doc_id,share_token,token_hash,payload,expires_at,created_by) values(m.workspace_id,d.id,raw_token,encode(sha256(convert_to(raw_token,'UTF8')),'hex'),share_payload_data,now()+make_interval(days=>expiry_days),m.id) returning * into l;
 elsif action_name='revoke' then if l.id is null then raise exception 'Pilih link';end if;update private.doc_share_links set revoked_at=now(),version=version+1 where id=l.id;
 else if l.id is null or l.revoked_at is not null or l.expires_at<=now() then raise exception 'Link unavailable';end if;update private.doc_share_links set payload=share_payload_data,version=version+1 where id=l.id;end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'doc_share_'||action_name,d.id::text,jsonb_build_object('link',l.id,'permission','view'));
 return jsonb_build_object('id',l.id,'expires_at',l.expires_at);
end$$;

create or replace function private.contacts_share_manage(a text,l uuid,token text,days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.memberships;link private.contact_share_links;p jsonb;begin
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses Internal edit wajib' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses ditolak' using errcode='42501';end if;
 if a='list' then return jsonb_build_object('links',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'expires_at',expires_at,'revoked_at',revoked_at,'share_token',share_token) order by expires_at desc),'[]') from private.contact_share_links where workspace_id=m.workspace_id and revoked_at is null));end if;
 p:=jsonb_build_object('kind','internal_contacts','title','Contacts','notes','[]'::jsonb,'contacts',private.contact_directory(m.workspace_id));
 if a='preview' then return p;end if;
 if a='create' then
  if token is null or token !~ '^([a-f0-9]{64}|[a-z0-9][a-z0-9-]{0,19}-[A-Za-z0-9_-]{22})$' or days is null or days not between 1 and 30 then raise exception 'Token / expiry tidak valid';end if;
  insert into private.contact_share_links(workspace_id,share_token,token_hash,payload,expires_at,created_by) values(m.workspace_id,token,encode(sha256(convert_to(token,'UTF8')),'hex'),p,now()+make_interval(days=>days),m.id) returning * into link;
 elsif a in ('publish','revoke') then
  select * into link from private.contact_share_links where id=l and workspace_id=m.workspace_id for update;
  if link.id is null then raise exception 'Link tidak ditemukan';end if;
  if a='revoke' then update private.contact_share_links set revoked_at=now() where id=link.id;
  else
   if link.revoked_at is not null or link.expires_at<=now() then raise exception 'Link unavailable';end if;
   update private.contact_share_links set payload=p where id=link.id;
  end if;
 else raise exception 'Action tidak valid';end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'contacts_share_'||a,m.workspace_id::text,jsonb_build_object('link',link.id));
 return jsonb_build_object('id',link.id,'expires_at',link.expires_at);
end$$;


create or replace function private.trip_share_manage(a text,trip uuid,link uuid,v integer,p jsonb,token text,days integer) returns jsonb language plpgsql security definer set search_path='' as $$declare m public.memberships;j public.journeys;l private.trip_access_links;begin
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'trips',true) then raise exception 'Akses Trips edit wajib' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 if not private.allowed(m.workspace_id,'trips',true) then raise exception 'Akses ditolak' using errcode='42501';end if;
 select * into j from public.journeys where id=trip and workspace_id=m.workspace_id and kind='trip';if j.id is null then raise exception 'Trip tidak ditemukan';end if;
 if a='list' then return jsonb_build_object('enabled',true,'links',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'permissions',x.permissions,'version',x.version,'expires_at',x.expires_at,'revoked_at',x.revoked_at,'share_token',x.share_token) order by x.expires_at desc),'[]') from private.trip_access_links x where x.trip_id=j.id and x.revoked_at is null));end if;
 if a not in ('create','publish','regenerate','revoke') then raise exception 'Action tidak valid';end if;
 if a<>'revoke' and j.data->>'lifecycle'<>'active' then raise exception 'Trip read-only';end if;
 if link is not null then select * into l from private.trip_access_links where id=link and trip_id=j.id for update;if l.id is null then raise exception 'Link tidak ditemukan';end if;end if;
 if a in ('publish','regenerate','revoke') and (l.id is null or l.version is distinct from v) then raise exception 'Link berubah; refresh daftar link' using errcode='40001';end if;
 if a<>'revoke' then p:=private.trip_permissions(p);if p->>'finance'<>'none' and not private.allowed(m.workspace_id,'finance',true) then raise exception 'Akses Finance edit wajib untuk membagikan Finance' using errcode='42501';end if;end if;
 if a in ('create','regenerate') then
  if token is null or token !~ '^([a-f0-9]{64}|[a-z0-9][a-z0-9-]{0,19}-[A-Za-z0-9_-]{22})$' or days is null or days not between 1 and 30 then raise exception 'Token / expiry tidak valid';end if;
  if a='regenerate' then update private.trip_access_links set revoked_at=now(),version=version+1 where id=l.id;end if;
  insert into private.trip_access_links(workspace_id,trip_id,share_token,token_hash,permissions,expires_at,created_by) values(m.workspace_id,j.id,token,encode(sha256(convert_to(token,'UTF8')),'hex'),p,now()+make_interval(days=>days),m.id) returning * into l;
 elsif a='revoke' then update private.trip_access_links set revoked_at=now(),version=version+1 where id=l.id;
 else
  if l.revoked_at is not null or l.expires_at<=now() then raise exception 'Link unavailable';end if;
  update private.trip_access_links set permissions=p,version=version+1 where id=l.id;
 end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'trip_share_'||a,j.id::text,jsonb_build_object('link',l.id,'permissions',case when a='revoke' then l.permissions else p end));
 return jsonb_build_object('id',l.id);
end$$;


create or replace function private.trip_access(token text) returns private.trip_access_links
language plpgsql set search_path='' as $$
declare l private.trip_access_links;
begin
 if token is null or token !~ '^([a-f0-9]{64}|[a-z0-9][a-z0-9-]{0,19}-[A-Za-z0-9_-]{22})$' then
  raise exception 'Link tidak tersedia' using errcode='42501';
 end if;
 select * into l from private.trip_access_links
 where (token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') or share_token=token)
 and revoked_at is null and expires_at>now() for share;
 if l.id is null then raise exception 'Link tidak tersedia' using errcode='42501';end if;
 if not private.consume_share_budget('live:'||l.id::text) then
  raise exception 'Terlalu banyak request. Coba kembali sebentar lagi.' using errcode='PT429';
 end if;
 return l;
end$$;


create or replace function private.share_read(token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare hashed text; link uuid; payload jsonb; kind text;
begin
 if token is null or token !~ '^([a-f0-9]{64}|[a-z0-9][a-z0-9-]{0,19}-[A-Za-z0-9_-]{22})$' then return null;end if;
 hashed:=encode(sha256(convert_to(token,'UTF8')),'hex');
 select l.id,s.payload into link,payload
 from private.share_links l
 join private.share_snapshots s on s.share_link_id=l.id
 join public.workspaces w on w.id=l.workspace_id
 where (l.token_hash=hashed or l.share_token=token) and l.revoked_at is null and l.expires_at>now() and w.sharing_enabled;
 kind:='trip';
 if payload is null then
  select l.id,l.payload into link,payload from private.doc_share_links l
  where (l.token_hash=hashed or l.share_token=token) and l.revoked_at is null and l.expires_at>now();
  kind:='doc';
 end if;
 if payload is null then
  select l.id,l.payload into link,payload from private.contact_share_links l
  where (l.token_hash=hashed or l.share_token=token) and l.revoked_at is null and l.expires_at>now();
  kind:='contacts';
 end if;
 if link is null or payload is null then return null;end if;
 if not private.consume_share_budget('snapshot:'||kind||':'||link::text) then return null;end if;
 return payload;
end$$;


create or replace function private.trip_public_command(token text,c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare l private.trip_access_links;j public.journeys;x jsonb;clean jsonb:='[]';old public.contacts;w uuid;begin
 if c->>'action'<>'content' or not (c->'data' ? 'contacts') then return private.trip_public_command_before_relational_contacts(token,c);end if;
 select workspace_id into w from private.trip_access_links where (token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') or share_token=token);
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

-- Remove only already revoked sharing capabilities. The FK changes above
-- preserve submitted finance records and remove dependent obsolete snapshots.
delete from private.share_links where revoked_at is not null;
delete from private.doc_share_links where revoked_at is not null;
delete from private.contact_share_links where revoked_at is not null;
delete from private.trip_access_links where revoked_at is not null;
notify pgrst,'reload schema';
