alter table public.workspaces add column sharing_enabled boolean not null default false;
create table private.share_links(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),trip_id uuid not null,token_hash text not null unique,expires_at timestamptz not null,revoked_at timestamptz,created_by uuid not null,version integer not null default 1,foreign key(trip_id,workspace_id) references public.journeys(id,workspace_id));
create table private.share_snapshots(share_link_id uuid primary key references private.share_links(id),schema_version integer not null default 1,payload jsonb not null,published_at timestamptz not null default now());
create table private.share_rate(bucket text primary key,window_start timestamptz not null,hits integer not null);
alter table private.share_links enable row level security;
alter table private.share_snapshots enable row level security;
alter table private.share_rate enable row level security;
revoke all on private.share_links,private.share_snapshots,private.share_rate from public,anon,authenticated;
create index share_workspace_trip on private.share_links(workspace_id,trip_id);
create index share_trip_fk on private.share_links(trip_id,workspace_id);

create function private.share_payload(trip_id uuid,selection jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare j public.journeys;payload jsonb;begin
 select * into j from public.journeys where id=trip_id and kind='trip';
 if j.id is null or jsonb_typeof(selection->'notes') is distinct from 'array' or jsonb_typeof(selection->'contacts') is distinct from 'array' then raise exception 'Pilihan share tidak valid';end if;
 payload:=jsonb_build_object('title',left(coalesce(selection->>'title',''),200),'notes',(select coalesce(jsonb_agg(jsonb_build_object('title',n->>'title','body',n->>'body')),'[]') from jsonb_array_elements(j.data->'notes') n where (selection->'notes') ? (n->>'id')),'contacts',(select coalesce(jsonb_agg(jsonb_build_object('name',c->>'name','role',c->>'role','organization',c->>'organization','phone',c->>'phone','email',c->>'email')),'[]') from jsonb_array_elements(j.data->'contacts') c where (selection->'contacts') ? (c->>'id')));
 if selection->>'dates'='true' then payload:=payload||jsonb_build_object('start',j.data->>'start','end',j.data->>'end');end if;
 if selection->>'itinerary'='true' then payload:=payload||jsonb_build_object('days',(select coalesce(jsonb_agg(jsonb_build_object('title',d->>'title','items',(select coalesce(jsonb_agg(jsonb_build_object('name',i->>'name','description',i->>'description')),'[]') from jsonb_array_elements(d->'items') i))),'[]') from jsonb_array_elements(j.data->'days') d));end if;
 return payload;
end$$;
create function private.share_manage(action_name text,trip_id uuid,link_id uuid,expected_version integer,selection jsonb,raw_token text,expiry_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
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
create function private.share_read(raw_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare hashed text;hits integer;payload jsonb;begin
 -- Database-backed global request budget cannot be bypassed by changing IP headers.
 insert into private.share_rate(bucket,window_start,hits) values('global',date_trunc('minute',now()),1) on conflict(bucket) do update set hits=case when private.share_rate.window_start=date_trunc('minute',now()) then private.share_rate.hits+1 else 1 end,window_start=date_trunc('minute',now()) returning private.share_rate.hits into hits;
 if hits>300 or raw_token is null or raw_token !~ '^[0-9a-f]{64}$' then return null;end if;
 hashed:=encode(sha256(convert_to(raw_token,'UTF8')),'hex');
 select s.payload into payload from private.share_links l join private.share_snapshots s on s.share_link_id=l.id join public.workspaces w on w.id=l.workspace_id where l.token_hash=hashed and l.revoked_at is null and l.expires_at>now() and w.sharing_enabled;
 return payload;
end$$;
create function public.app_share_manage(action_name text,trip_id uuid,link_id uuid default null,expected_version integer default null,selection jsonb default '{"notes":[],"contacts":[]}',raw_token text default null,expiry_days integer default 7) returns jsonb language sql security invoker set search_path='' as $$select private.share_manage(action_name,trip_id,link_id,expected_version,selection,raw_token,expiry_days)$$;
create function public.app_share_read(raw_token text) returns jsonb language sql security invoker set search_path='' as $$select private.share_read(raw_token)$$;
revoke all on function private.share_payload(uuid,jsonb),private.share_manage(text,uuid,uuid,integer,jsonb,text,integer),private.share_read(text),public.app_share_manage(text,uuid,uuid,integer,jsonb,text,integer),public.app_share_read(text) from public,anon,authenticated;
grant execute on function private.share_manage(text,uuid,uuid,integer,jsonb,text,integer),public.app_share_manage(text,uuid,uuid,integer,jsonb,text,integer) to authenticated;
grant execute on function private.share_read(text),public.app_share_read(text) to anon,authenticated;
grant usage on schema private to anon;
notify pgrst,'reload schema';

