create function private.valid_privileges(p jsonb) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(p)='object' and p ?& array['sales','trips','finance'] and p->>'sales' in ('none','view','edit') and p->>'trips' in ('none','view','edit') and p->>'finance' in ('none','view','edit'),false)$$;
alter table public.memberships add constraint valid_module_privileges check(private.valid_privileges(privileges));
alter table private.invitations add constraint valid_invitation_privileges check(private.valid_privileges(privileges));
create function private.invite_privilege(invitation_id uuid,requested_privileges jsonb,expected_version integer) returns uuid language plpgsql security definer set search_path='' as $$declare m public.memberships;begin
 m:=private.me();if m.id is null or m.role<>'admin' then raise exception 'Admin only' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 if not private.valid_privileges(requested_privileges) then raise exception 'Privilege tidak valid';end if;
 update private.invitations set privileges=requested_privileges,version=version+1 where id=invitation_id and workspace_id=m.workspace_id and status in ('pending','sent','failed') and version=expected_version;if not found then raise exception 'Invitation berubah atau tidak aktif. Reload.' using errcode='40001';end if;
 insert into private.audit_events(workspace_id,actor,action,entity) values(m.workspace_id,m.id,'invitation_privilege',invitation_id::text);return invitation_id;
end$$;
create function public.update_invitation(invitation_id uuid,requested_privileges jsonb,expected_version integer) returns uuid language sql security invoker set search_path='' as $$select private.invite_privilege(invitation_id,requested_privileges,expected_version)$$;
revoke all on function private.valid_privileges(jsonb),private.invite_privilege(uuid,jsonb,integer),public.update_invitation(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function private.invite_privilege(uuid,jsonb,integer),public.update_invitation(uuid,jsonb,integer) to authenticated;
grant usage on schema private to service_role;
grant execute on function private.valid_privileges(jsonb) to service_role;

create function private.document_integrity() returns trigger language plpgsql set search_path='' as $$declare d jsonb:=new.data;x jsonb;y jsonb;n integer;distinct_n integer;begin
 if octet_length(d::text)>512000 then raise exception 'Dokumen terlalu besar';end if;
 if new.source_lead is not null and not exists(select 1 from public.journeys where id=new.source_lead and workspace_id=new.workspace_id and kind='lead') then raise exception 'Sumber harus Lead';end if;
 select count(*),count(distinct value) into n,distinct_n from jsonb_array_elements_text(d->'people');if n<>distinct_n then raise exception 'Assigned people duplikat';end if;
 select count(*),count(distinct v->>'id') into n,distinct_n from jsonb_array_elements(d->'notes') v;if n<>distinct_n then raise exception 'Note ID duplikat';end if;
 select count(*),count(distinct v->>'id') into n,distinct_n from jsonb_array_elements(d->'contacts') v;if n<>distinct_n then raise exception 'Contact ID duplikat';end if;
 select count(*),count(distinct id) into n,distinct_n from (select v->>'id' id from jsonb_array_elements(d->'days') v union all select i->>'id' from jsonb_array_elements(d->'days') v cross join lateral jsonb_array_elements(v->'items') i) ids;if n<>distinct_n then raise exception 'Day/item ID duplikat';end if;
 for x in select jsonb_array_elements(d->'notes') loop if jsonb_typeof(x->'body') is distinct from 'string' or jsonb_typeof(x->'title') is distinct from 'string' or length(x->>'title')>120 then raise exception 'Note fields tidak valid';end if;end loop;
 for x in select jsonb_array_elements(d->'contacts') loop
  if jsonb_typeof(x->'name') is distinct from 'string' or length(x->>'name')>200 or jsonb_typeof(x->'role') is distinct from 'string' or jsonb_typeof(x->'organization') is distinct from 'string' or jsonb_typeof(x->'phone') is distinct from 'string' or jsonb_typeof(x->'email') is distinct from 'string' or jsonb_typeof(x->'note') is distinct from 'string' or length(x->>'note')>5000 or length(x->>'phone')>80 then raise exception 'Contact fields tidak valid';end if;
  if x->>'email'<>'' and x->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Contact email tidak valid';end if;
 end loop;
 for x in select jsonb_array_elements(d->'days') loop if jsonb_typeof(x->'title') is distinct from 'string' or length(x->>'title')>200 then raise exception 'Day title tidak valid';end if;for y in select jsonb_array_elements(x->'items') loop if jsonb_typeof(y->'name') is distinct from 'string' or jsonb_typeof(y->'description') is distinct from 'string' or length(y->>'name')>200 then raise exception 'Activity fields tidak valid';end if;end loop;end loop;
 return new;
end$$;
create trigger journey_document_integrity before insert or update on public.journeys for each row execute function private.document_integrity();
alter table private.audit_events add column request_id text not null default txid_current()::text;
