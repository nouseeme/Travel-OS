-- An independent user task count and a workspace contact directory.
create table private.internal_contacts (
 workspace_id uuid primary key references public.workspaces(id),
 contacts jsonb not null default '[]', version integer not null default 1
);
alter table private.internal_contacts enable row level security;
revoke all on private.internal_contacts from public,anon,authenticated;

create function private.contact_directory(w uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(c order by lower(c->>'name'),c->>'source'),'[]') from (
 select c||jsonb_build_object('source',case j.kind when 'lead' then 'CRM' else 'Trip' end||' · '||coalesce(nullif(j.data->>'name',''),j.data->>'client'),'source_id',j.id,'source_kind',j.kind) c
 from public.journeys j cross join lateral jsonb_array_elements(coalesce(j.data->'contacts','[]')) c
 where j.workspace_id=w and private.allowed(w,case j.kind when 'lead' then 'sales' else 'trips' end)
 union all
 select c||jsonb_build_object('source','Internal','source_id',null,'source_kind','internal')
 from private.internal_contacts x cross join lateral jsonb_array_elements(x.contacts) c where x.workspace_id=w
 ) rows;
$$;

alter function private.snapshot(text,jsonb,uuid) rename to snapshot_before_contacts;
create function private.snapshot(v text,f jsonb,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;m public.memberships;n integer;begin
 s:=private.snapshot_before_contacts(v,f,i);m:=private.me();
 select count(*) into n from public.tasks t where t.workspace_id=m.workspace_id and t.assignee=m.id and t.data->>'cancelled_at' is null and t.data->>'status'<>'Done';
 s:=s||jsonb_build_object('homeTaskCount',n);
 if v='docs' and i is null then
  s:=s||jsonb_build_object('contactDirectory',private.contact_directory(m.workspace_id),'internalContacts',coalesce((select jsonb_build_object('contacts',contacts,'version',version) from private.internal_contacts where workspace_id=m.workspace_id),'{"contacts":[],"version":1}'::jsonb));
 end if;return s;
end$$;

alter function private.command(jsonb) rename to command_before_contacts;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships;before_data jsonb;v integer;begin
 if c->>'action'<>'save_internal_contacts' then return private.command_before_contacts(c);end if;
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses Internal edit wajib' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform private.validate_content(jsonb_build_object('contacts',c->'data'->'contacts'));
 insert into private.internal_contacts(workspace_id) values(m.workspace_id) on conflict do nothing;
 select contacts,version into before_data,v from private.internal_contacts where workspace_id=m.workspace_id for update;
 if (c->>'version')::integer is distinct from v then raise exception 'Contacts berubah; reload dulu' using errcode='40001';end if;
 update private.internal_contacts set contacts=c->'data'->'contacts',version=version+1 where workspace_id=m.workspace_id;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'save_internal_contacts',m.workspace_id::text,jsonb_build_object('before',before_data,'after',c->'data'->'contacts'));
 return m.workspace_id;
end$$;

create table private.contact_share_links(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),token_hash text not null unique,payload jsonb not null,expires_at timestamptz not null,revoked_at timestamptz,created_by uuid not null);
alter table private.contact_share_links enable row level security;
revoke all on private.contact_share_links from public,anon,authenticated;
create function private.contacts_share_manage(a text,l uuid,token text,days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.memberships;link private.contact_share_links;p jsonb;begin
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses Internal edit wajib' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses ditolak' using errcode='42501';end if;
 if a='list' then return jsonb_build_object('links',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'expires_at',expires_at,'revoked_at',revoked_at) order by expires_at desc),'[]') from private.contact_share_links where workspace_id=m.workspace_id));end if;
 p:=jsonb_build_object('kind','internal_contacts','title','Contacts','notes','[]'::jsonb,'contacts',private.contact_directory(m.workspace_id));
 if a='preview' then return p;end if;
 if a='create' then
  if token is null or token !~ '^[a-f0-9]{64}$' or days is null or days not between 1 and 30 then raise exception 'Token / expiry tidak valid';end if;
  insert into private.contact_share_links(workspace_id,token_hash,payload,expires_at,created_by) values(m.workspace_id,encode(sha256(convert_to(token,'UTF8')),'hex'),p,now()+make_interval(days=>days),m.id) returning * into link;
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
create function public.app_contacts_share_manage(action_name text,link_id uuid default null,raw_token text default null,expiry_days integer default 7) returns jsonb language sql security invoker set search_path='' as $$select private.contacts_share_manage(action_name,link_id,raw_token,expiry_days)$$;
alter function private.share_read(text) rename to share_read_before_contacts;
create function private.share_read(token text) returns jsonb language plpgsql security definer set search_path='' as $$declare p jsonb;begin
 p:=private.share_read_before_contacts(token);if p is not null then return p;end if;
 if token is null or token !~ '^[a-f0-9]{64}$' or (select hits from private.share_rate where bucket='global')>300 then return null;end if;
 select payload into p from private.contact_share_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and revoked_at is null and expires_at>now();return p;
end$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
create or replace function public.app_share_read(raw_token text) returns jsonb language sql security invoker set search_path='' as $$select private.share_read(raw_token)$$;
revoke all on function private.contact_directory(uuid),private.snapshot_before_contacts(text,jsonb,uuid),private.snapshot(text,jsonb,uuid),private.command_before_contacts(jsonb),private.command(jsonb),private.contacts_share_manage(text,uuid,text,integer),public.app_contacts_share_manage(text,uuid,text,integer),private.share_read_before_contacts(text),private.share_read(text) from public,anon,authenticated;
grant execute on function private.snapshot(text,jsonb,uuid),private.command(jsonb),private.contacts_share_manage(text,uuid,text,integer),public.app_contacts_share_manage(text,uuid,text,integer) to authenticated;
grant execute on function private.share_read(text) to anon,authenticated;
notify pgrst,'reload schema';
