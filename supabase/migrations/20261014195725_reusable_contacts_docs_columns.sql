-- Shared identity for reused contacts, without rewriting historical documents or share snapshots.
-- Name + email/phone groups known duplicates; contacts without a channel only group by UUID.
create function private.contact_key(c jsonb) returns text language sql immutable set search_path='' as $$
 select case when trim(coalesce(c->>'email',''))<>'' then 'email:'||lower(trim(c->>'email'))||':'||lower(trim(c->>'name'))
 when regexp_replace(coalesce(c->>'phone',''),'[^0-9]','','g')<>'' then 'phone:'||regexp_replace(c->>'phone','[^0-9]','','g')||':'||lower(trim(c->>'name'))
 else 'id:'||coalesce(c->>'id','') end;
$$;

create or replace function private.contact_directory(w uuid) returns jsonb language sql stable set search_path='' as $$
 with raw_occurrences as (
 select c,private.contact_key(c) identity,j.version,j.updated_at at,
   case j.kind when 'lead' then 'CRM' else 'Trip' end||' · '||coalesce(nullif(j.data->>'name',''),j.data->>'client') label,
   j.id source_id,j.kind source_kind
 from public.journeys j cross join lateral jsonb_array_elements(coalesce(j.data->'contacts','[]')) c
 where j.workspace_id=w and private.allowed(w,case j.kind when 'lead' then 'sales' else 'trips' end)
 union all
 select c,private.contact_key(c),x.version,'1970-01-01'::timestamptz,'Internal',null,'internal'
 from private.internal_contacts x cross join lateral jsonb_array_elements(x.contacts) c where x.workspace_id=w and private.allowed(w,'docs')
 ), identities as (
 select c->>'id' id,min(c->>'id') over(partition by identity) canonical from raw_occurrences
 ), mapping as (
 select id,min(canonical) canonical from identities group by id
 ), occurrences as (
 select r.c,map.canonical identity,r.version,r.at,r.label,r.source_id,r.source_kind from raw_occurrences r join mapping map on map.id=r.c->>'id'
 ), grouped as (
 select identity,(array_agg(c order by at desc,source_id,c->>'id'))[1] c,
   min(c->>'id') id,sum(version)::integer version from occurrences group by identity
 ), result as (
 select g.c||jsonb_build_object('id',g.id,'version',g.version,'sources',sources,
   'source',(select string_agg(s->>'label',', ') from jsonb_array_elements(sources) s),
   'source_id',sources->0->'id','source_kind',sources->0->>'kind') c
 from grouped g cross join lateral (
 select jsonb_agg(jsonb_build_object('label',label,'id',source_id,'kind',source_kind) order by at desc,source_id) sources
 from (select label,source_id,source_kind,max(at) at from occurrences where identity=g.identity group by label,source_id,source_kind order by max(at) desc,source_id limit 5) recent
 ) s
 ) select coalesce(jsonb_agg(c order by lower(c->>'name'),c->>'id'),'[]') from result;
$$;

alter function private.command(jsonb) rename to command_before_contact_edit;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships;original jsonb;d jsonb:=c->'data'->'contact';key text;j public.journeys;next_contacts jsonb;before_internal jsonb;
begin
 if c->>'action'<>'edit_contact' then return private.command_before_contact_edit(c);end if;
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses Internal edit wajib' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 m:=private.me();if m.id is null or not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses ditolak' using errcode='42501';end if;
 select x into original from jsonb_array_elements(private.contact_directory(m.workspace_id)) x where x->>'id'=c->>'id';
 if original is null then raise exception 'Contact tidak ditemukan' using errcode='42501';end if;
 if (original->>'version')::integer is distinct from (c->>'version')::integer then raise exception 'Contact berubah; reload dulu' using errcode='40001';end if;
 if jsonb_typeof(d) is distinct from 'object' or d->>'id' is distinct from c->>'id' then raise exception 'Contact tidak valid';end if;
 if exists(select 1 from jsonb_object_keys(d) k where k not in ('id','name','phone','email','note','role','organization')) then raise exception 'Field contact tidak valid';end if;
 if exists(select 1 from unnest(array['id','name','phone','email','note','role','organization']) k where jsonb_typeof(d->k) is distinct from 'string') then raise exception 'Field contact harus teks';end if;
 perform (d->>'id')::uuid;
 if length(trim(d->>'name')) not between 1 and 200 or length(d->>'phone')>80 or length(d->>'email')>320 or length(d->>'note')>5000 or length(d->>'role')>200 or length(d->>'organization')>200 then raise exception 'Contact tidak valid';end if;
 if d->>'email'<>'' and d->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Email tidak valid';end if;
 key:=private.contact_key(original);
 -- Updating this shared contact is a narrow Internal edit capability, not permission to edit parent documents.
 for j in select * from public.journeys where workspace_id=m.workspace_id and exists(select 1 from jsonb_array_elements(data->'contacts') x where private.contact_key(x)=key or x->>'id'=original->>'id') for update loop
  select jsonb_agg(case when private.contact_key(x)=key or x->>'id'=original->>'id' then d||jsonb_build_object('id',x->>'id') else x end order by position) into next_contacts from jsonb_array_elements(j.data->'contacts') with ordinality a(x,position);
  update public.journeys set data=jsonb_set(data,'{contacts}',next_contacts),version=version+1,updated_at=now() where id=j.id;
 end loop;
 select contacts into before_internal from private.internal_contacts where workspace_id=m.workspace_id for update;
 if before_internal is not null and exists(select 1 from jsonb_array_elements(before_internal) x where private.contact_key(x)=key or x->>'id'=original->>'id') then
  select jsonb_agg(case when private.contact_key(x)=key or x->>'id'=original->>'id' then d||jsonb_build_object('id',x->>'id') else x end order by position) into next_contacts from jsonb_array_elements(before_internal) with ordinality a(x,position);
  update private.internal_contacts set contacts=next_contacts,version=version+1 where workspace_id=m.workspace_id;
 end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'edit_contact',c->>'id',jsonb_build_object('before',original-array['sources','source','source_id','source_kind','version'],'after',d));
 return (c->>'id')::uuid;
end$$;

-- Filters and ordering run before pagination, and use only allowlisted column names.
create function private.docs_filtered(w uuid,f jsonb,i uuid) returns setof public.internal_docs language sql stable set search_path='' as $$
 select d from public.internal_docs d left join public.memberships p on p.id=d.creator
 where d.workspace_id=w and (i is null or d.id=i)
 and (coalesce(f->>'search','')='' or position(lower(f->>'search') in lower(d.title||' '||d.category))>0)
 and (coalesce(f->>'title','')='' or position(lower(f->>'title') in lower(d.title))>0)
 and (coalesce(f->>'creator','')='' or position(lower(f->>'creator') in lower(coalesce(p.name,'')))>0)
 and (coalesce(f->>'category','')='' or position(lower(f->>'category') in lower(d.category))>0)
 and (coalesce(f->>'from','')='' or d.date>=(f->>'from')::date)
 and (coalesce(f->>'to','')='' or d.date<=(f->>'to')::date);
$$;
alter function private.snapshot(text,jsonb,uuid) rename to snapshot_before_column_controls;
create function private.snapshot(v text,f jsonb,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;m public.memberships;docs jsonb;cnt integer;sort_key text:=coalesce(f->>'sort','date');sort_order text:=coalesce(f->>'order','desc');begin
 s:=private.snapshot_before_column_controls(v,f,i);m:=private.me();
 if v in ('sales','trips','docs') and not (v='docs' and i is not null) then s:=s||jsonb_build_object('contactDirectory',private.contact_directory(m.workspace_id));end if;
 if v='docs' then
  if sort_key not in ('title','date','creator','category') or sort_order not in ('asc','desc') then raise exception 'Sort tidak valid';end if;
  select count(*) into cnt from private.docs_filtered(m.workspace_id,f,i);
  select coalesce(jsonb_agg(payload order by position),'[]') into docs from (
   select case when i is null then to_jsonb(d)-array['workspace_id','body'] else to_jsonb(d)-'workspace_id' end payload,
   row_number() over(order by
    case when sort_order='asc' then case sort_key when 'title' then lower(d.title) when 'date' then d.date::text when 'creator' then lower(coalesce(p.name,'')) else lower(d.category) end end asc,
    case when sort_order='desc' then case sort_key when 'title' then lower(d.title) when 'date' then d.date::text when 'creator' then lower(coalesce(p.name,'')) else lower(d.category) end end desc,d.id) position
   from private.docs_filtered(m.workspace_id,f,i) d left join public.memberships p on p.id=d.creator
   order by position limit 50 offset case when i is not null then 0 else greatest(0,coalesce((f->>'page')::integer,0))*50 end
  ) ordered;
  s:=s||jsonb_build_object('documents',docs,'count',cnt);
 end if;return s;
end$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
revoke all on function private.contact_key(jsonb),private.contact_directory(uuid),private.command_before_contact_edit(jsonb),private.command(jsonb),private.docs_filtered(uuid,jsonb,uuid),private.snapshot_before_column_controls(text,jsonb,uuid),private.snapshot(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.command(jsonb),private.snapshot(text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
