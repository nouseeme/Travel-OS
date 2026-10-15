-- Older demo contacts used arbitrary MD5 bytes as UUIDs. PostgreSQL accepts them,
-- but the HTTP contract requires RFC UUID version/variant bits. Replace those
-- identifiers atomically while retaining contact fields, order and every link.
do $$
declare w uuid:='10000000-0000-4000-8000-000000000001';c public.contacts;replacement uuid;links jsonb;actor uuid;contact_count bigint;link_count bigint;
begin
 perform 1 from public.workspaces where id=w for update;
 select count(*) into contact_count from public.contacts where workspace_id=w;
 select count(*) into link_count from public.journey_contacts where workspace_id=w;
 select id into actor from public.memberships where workspace_id=w and role='admin' and status='active' order by id limit 1;
 for c in select * from public.contacts where workspace_id=w and id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' for update loop
  replacement:=gen_random_uuid();
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into links from public.journey_contacts r where workspace_id=w and contact_id=c.id;
  update public.journeys j set version=version+1,updated_at=now() where j.workspace_id=w and exists(select 1 from public.journey_contacts r where r.workspace_id=w and r.journey_id=j.id and r.contact_id=c.id);
  delete from public.contacts where id=c.id;
  insert into public.contacts(id,workspace_id,name,phone,email,role,organization,note,internal_saved,version,created_at,updated_at)
  values(replacement,w,c.name,c.phone,c.email,c.role,c.organization,c.note,c.internal_saved,c.version+1,c.created_at,now());
  insert into public.journey_contacts(workspace_id,journey_id,contact_id,position)
  select r.workspace_id,r.journey_id,replacement,r.position from jsonb_populate_recordset(null::public.journey_contacts,links) r;
  if actor is not null then
   insert into private.audit_events(workspace_id,actor,action,entity,metadata) values(w,actor,'repair_contact_id',replacement::text,jsonb_build_object('old_id',c.id,'new_id',replacement));
  end if;
 end loop;
 if (select count(*) from public.contacts where workspace_id=w)<>contact_count or (select count(*) from public.journey_contacts where workspace_id=w)<>link_count then raise exception 'Contact ID repair changed record counts';end if;
end$$;
notify pgrst,'reload schema';
