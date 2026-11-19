create table private.note_share_links (
  journey_id uuid not null references public.journeys(id) on delete cascade,
  note_id uuid not null,
  module_slug text not null,
  note_slug text not null,
  share_key text not null unique default replace(gen_random_uuid()::text, '-', ''),
  primary key (journey_id, note_id)
);

alter table private.note_share_links enable row level security;
revoke all on table private.note_share_links from public, anon, authenticated;

create function private.note_share_slug(title text, fallback text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(nullif(trim(both '-' from left(regexp_replace(
    lower(regexp_replace(normalize(coalesce(title, ''), NFKD), U&'[\0300-\036F]', '', 'g')),
    '[^a-z0-9]+', '-', 'g'
  ), 80)), ''), fallback)
$$;

create function private.note_share_manage(
  action_name text, parent_id uuid, target_note_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  member public.memberships;
  journey public.journeys;
  note jsonb;
  link private.note_share_links;
begin
  member := private.me();
  if member.id is null then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  if action_name is null or action_name not in ('status', 'create', 'revoke') then
    raise exception 'Action tidak valid';
  end if;

  if action_name <> 'status' then
    perform 1 from public.workspaces where id = member.workspace_id for update;
  end if;
  select * into journey from public.journeys
    where id = parent_id and workspace_id = member.workspace_id;
  if journey.id is null or not private.allowed(
    member.workspace_id, case journey.kind when 'lead' then 'sales' else 'trips' end, true
  ) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  -- Public Trip edits also lock the journey row while updating its notes.
  if action_name <> 'status' then
    select * into journey from public.journeys where id = journey.id for update;
  end if;
  select value into note from jsonb_array_elements(journey.data->'notes')
    where value->>'id' = target_note_id::text;
  if note is null then
    raise exception 'Note tidak ditemukan';
  end if;

  if action_name = 'revoke' then
    delete from private.note_share_links
      where journey_id = parent_id and note_id = target_note_id returning * into link;
  elsif action_name = 'create' then
    if journey.data->>'lifecycle' is distinct from 'active' then
      raise exception 'Record read-only' using errcode = '42501';
    end if;
    insert into private.note_share_links (journey_id, note_id, module_slug, note_slug)
      values (
        parent_id, target_note_id,
        private.note_share_slug(journey.data->>'name', case journey.kind when 'lead' then 'sales' else 'trip' end),
        private.note_share_slug(note->>'title', 'note')
      )
      on conflict (journey_id, note_id) do nothing
      returning * into link;
  end if;

  if link.share_key is not null then
    insert into private.audit_events (workspace_id, actor, action, entity, metadata)
      values (member.workspace_id, member.id, 'note_share_' || action_name,
        target_note_id::text, jsonb_build_object('journey', parent_id));
  end if;
  if action_name = 'revoke' then return null; end if;

  select * into link from private.note_share_links
    where journey_id = parent_id and note_id = target_note_id;
  if link.share_key is null then return null; end if;
  return jsonb_build_object(
    'moduleSlug', link.module_slug, 'noteSlug', link.note_slug, 'key', link.share_key
  );
end;
$$;

create function private.note_share_read(module_path text, note_path text, access_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('title', note.value->>'title', 'body', note.value->>'body')
  from private.note_share_links link
  join public.journeys journey on journey.id = link.journey_id
  cross join lateral jsonb_array_elements(journey.data->'notes') note
  where link.share_key = access_key
    and link.module_slug = module_path and link.note_slug = note_path
    and note.value->>'id' = link.note_id::text
$$;

create function private.prune_deleted_note_shares()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from private.note_share_links link
    where link.journey_id = new.id
      and not exists (
        select 1 from jsonb_array_elements(new.data->'notes') note
        where note.value->>'id' = link.note_id::text
      );
  return null;
end;
$$;

create trigger prune_deleted_note_shares
after update of data on public.journeys
for each row when (old.data->'notes' is distinct from new.data->'notes')
execute function private.prune_deleted_note_shares();

create function public.app_note_share_manage(
  action_name text, parent_id uuid, target_note_id uuid
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.note_share_manage(action_name, parent_id, target_note_id)
$$;

create function public.app_note_share_read(module_path text, note_path text, access_key text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.note_share_read(module_path, note_path, access_key)
$$;

revoke all on function private.note_share_slug(text, text), private.prune_deleted_note_shares(),
  private.note_share_manage(text, uuid, uuid), public.app_note_share_manage(text, uuid, uuid),
  private.note_share_read(text, text, text), public.app_note_share_read(text, text, text)
  from public, anon, authenticated;
grant execute on function private.note_share_manage(text, uuid, uuid),
  public.app_note_share_manage(text, uuid, uuid) to authenticated;
grant execute on function private.note_share_read(text, text, text),
  public.app_note_share_read(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
