-- A busy bearer link must not exhaust every other link or serialize all reads.
-- Allocate buckets only after finding a valid capability, so random tokens cannot
-- grow this table. The helper is callable only from the definer entry points.
create function private.consume_share_budget(key text) returns boolean
language plpgsql set search_path='' as $$
declare current_window timestamptz:=date_trunc('minute',clock_timestamp()); n integer;
begin
 insert into private.share_rate as r(bucket,window_start,hits)
 values(key,current_window,1)
 on conflict(bucket) do update set
  hits=case when r.window_start=current_window then least(r.hits+1,301) else 1 end,
  window_start=current_window
 returning hits into n;
 return n<=300;
end$$;
revoke all on function private.consume_share_budget(text) from public,anon,authenticated;

create or replace function private.trip_access(token text) returns private.trip_access_links
language plpgsql set search_path='' as $$
declare l private.trip_access_links;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then
  raise exception 'Link tidak tersedia' using errcode='42501';
 end if;
 select * into l from private.trip_access_links
 where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex')
 and revoked_at is null and expires_at>now() for share;
 if l.id is null then raise exception 'Link tidak tersedia' using errcode='42501';end if;
 if not private.consume_share_budget('live:'||l.id::text) then
  raise exception 'Terlalu banyak request. Coba kembali sebentar lagi.' using errcode='PT429';
 end if;
 return l;
end$$;

-- Preserve Trip snapshot gating and Docs/Contacts publication contracts while
-- replacing the chain of global-budget readers with one capability lookup.
create or replace function private.share_read(token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare hashed text; link uuid; payload jsonb; kind text;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then return null;end if;
 hashed:=encode(sha256(convert_to(token,'UTF8')),'hex');
 select l.id,s.payload into link,payload
 from private.share_links l
 join private.share_snapshots s on s.share_link_id=l.id
 join public.workspaces w on w.id=l.workspace_id
 where l.token_hash=hashed and l.revoked_at is null and l.expires_at>now() and w.sharing_enabled;
 kind:='trip';
 if payload is null then
  select l.id,l.payload into link,payload from private.doc_share_links l
  where l.token_hash=hashed and l.revoked_at is null and l.expires_at>now();
  kind:='doc';
 end if;
 if payload is null then
  select l.id,l.payload into link,payload from private.contact_share_links l
  where l.token_hash=hashed and l.revoked_at is null and l.expires_at>now();
  kind:='contacts';
 end if;
 if link is null or payload is null then return null;end if;
 if not private.consume_share_budget('snapshot:'||kind||':'||link::text) then return null;end if;
 return payload;
end$$;
