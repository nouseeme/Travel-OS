-- The owner defines normalized equal names as the same contact.
create or replace function private.contact_key(c jsonb) returns text language sql immutable set search_path='' as $$select 'name:'||lower(regexp_replace(trim(c->>'name'),'[[:space:]]+',' ','g'))$$;
alter table public.internal_docs add column deleted_at timestamptz;
alter policy docs_read on public.internal_docs using(deleted_at is null and private.allowed(workspace_id,'docs'));
alter function private.docs_filtered(uuid,jsonb,uuid) rename to docs_filtered_before_bulk;
create function private.docs_filtered(w uuid,f jsonb,i uuid) returns setof public.internal_docs language sql stable set search_path='' as $$select d from private.docs_filtered_before_bulk(w,f,i) d where d.deleted_at is null$$;
alter function private.snapshot(text,jsonb,uuid) rename to snapshot_before_bulk;
create function private.snapshot(v text,f jsonb,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if v='docs' and i is not null and not exists(select 1 from public.internal_docs where id=i and workspace_id=(private.me()).workspace_id and deleted_at is null) then raise exception 'Dokumen tidak ditemukan' using errcode='42501';end if;
 return private.snapshot_before_bulk(v,f,i);
end$$;
alter function private.command(jsonb) rename to command_before_bulk;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships;a text:=c->>'action';r uuid;x jsonb;original jsonb;keys text[]:='{}';ids text[]:='{}';directory jsonb;j public.journeys;before_data jsonb;after_data jsonb;doc public.internal_docs;
begin
 if a not in ('bulk_action','delete_contacts','delete_docs','delete_budget') then
  if a='update_doc' and exists(select 1 from public.internal_docs where id=(c->>'id')::uuid and deleted_at is not null) then raise exception 'Dokumen dihapus' using errcode='42501';end if;
  return private.command_before_bulk(c);
 end if;
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 if a='bulk_action' then
  if jsonb_typeof(c->'data'->'commands') is distinct from 'array' or jsonb_array_length(c->'data'->'commands') not between 1 and 100 then raise exception 'Bulk commands tidak valid';end if;
  for x in select value from jsonb_array_elements(c->'data'->'commands') loop
   if coalesce(x->>'action','') not in ('archive','void_transaction','deactivate','revoke_invite','delete_budget') then raise exception 'Bulk action tidak valid';end if;
   r:=private.command(x);
  end loop;return r;
 elsif a='delete_budget' then
  if not private.allowed(m.workspace_id,'finance',true) or not private.allowed(m.workspace_id,'trips') then raise exception 'Akses budget ditolak' using errcode='42501';end if;
  select to_jsonb(b) into before_data from public.trip_budgets b where workspace_id=m.workspace_id and trip_id=(c->'data'->>'trip')::uuid and category_id=c->'data'->>'category' for update;
  if before_data is null or (before_data->>'version')::integer is distinct from (c->>'version')::integer then raise exception 'Budget berubah; reload dulu' using errcode='40001';end if;
  delete from public.trip_budgets where workspace_id=m.workspace_id and trip_id=(c->'data'->>'trip')::uuid and category_id=c->'data'->>'category';
  insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'delete_budget',c->'data'->>'trip',jsonb_build_object('before',before_data,'after',null));return (c->'data'->>'trip')::uuid;
 end if;
 if not private.allowed(m.workspace_id,'docs',true) then raise exception 'Akses Internal edit wajib' using errcode='42501';end if;
 if jsonb_typeof(c->'data'->'records') is distinct from 'array' or jsonb_array_length(c->'data'->'records') not between 1 and 100 then raise exception 'Records tidak valid';end if;
 if (select count(*) from jsonb_array_elements(c->'data'->'records'))<>(select count(distinct x->>'id') from jsonb_array_elements(c->'data'->'records') x) then raise exception 'Records duplikat';end if;
 if a='delete_docs' then
  -- A failed version/access check rolls the entire batch back, including revoked links.
  for x in select value from jsonb_array_elements(c->'data'->'records') loop
   select * into doc from public.internal_docs where workspace_id=m.workspace_id and id=(x->>'id')::uuid and deleted_at is null for update;
   if doc.id is null then raise exception 'Dokumen tidak ditemukan' using errcode='42501';end if;
   if doc.version is distinct from (x->>'version')::integer then raise exception 'Dokumen berubah; reload dulu' using errcode='40001';end if;
   update public.internal_docs set deleted_at=now(),updated_at=now(),version=version+1 where id=doc.id;
   update private.doc_share_links set revoked_at=now(),version=version+1 where doc_id=doc.id and revoked_at is null;
   insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'delete_doc',doc.id::text,jsonb_build_object('before',to_jsonb(doc)-'workspace_id','after',null));r:=doc.id;
  end loop;return r;
 end if;
 directory:=private.contact_directory(m.workspace_id);
 for x in select value from jsonb_array_elements(c->'data'->'records') loop
  select item into original from jsonb_array_elements(directory) item where item->>'id'=x->>'id';
  if original is null then raise exception 'Contact tidak ditemukan' using errcode='42501';end if;
  if (original->>'version')::integer is distinct from (x->>'version')::integer then raise exception 'Contact berubah; reload dulu' using errcode='40001';end if;
  keys:=array_append(keys,private.contact_key(original));ids:=array_append(ids,original->>'id');
 end loop;
 for j in select * from public.journeys where workspace_id=m.workspace_id and exists(select 1 from jsonb_array_elements(data->'contacts') x where private.contact_key(x)=any(keys) or x->>'id'=any(ids)) for update loop
  select coalesce(jsonb_agg(x order by p),'[]') into after_data from jsonb_array_elements(j.data->'contacts') with ordinality t(x,p) where private.contact_key(x)<>all(keys) and x->>'id'<>all(ids);
  update public.journeys set data=jsonb_set(data,'{contacts}',after_data),version=version+1,updated_at=now() where id=j.id;
  insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'delete_contacts',j.id::text,jsonb_build_object('before',j.data->'contacts','after',after_data));
 end loop;
 select contacts into before_data from private.internal_contacts where workspace_id=m.workspace_id for update;
 if before_data is not null then
  select coalesce(jsonb_agg(x order by p),'[]') into after_data from jsonb_array_elements(before_data) with ordinality t(x,p) where private.contact_key(x)<>all(keys) and x->>'id'<>all(ids);
  if before_data<>after_data then update private.internal_contacts set contacts=after_data,version=version+1 where workspace_id=m.workspace_id;end if;
 end if;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(m.workspace_id,m.id,'delete_contacts',m.workspace_id::text,jsonb_build_object('before',before_data,'after',after_data,'names',keys));
 return m.workspace_id;
end$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
revoke all on function private.docs_filtered_before_bulk(uuid,jsonb,uuid),private.docs_filtered(uuid,jsonb,uuid),private.snapshot_before_bulk(text,jsonb,uuid),private.snapshot(text,jsonb,uuid),private.command_before_bulk(jsonb),private.command(jsonb) from public,anon,authenticated;
grant execute on function private.snapshot(text,jsonb,uuid),private.command(jsonb) to authenticated;
notify pgrst,'reload schema';
