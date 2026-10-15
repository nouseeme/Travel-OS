-- The installation serves one shared help page. Only its access decision is public.
alter table public.workspaces add column help_public boolean not null default true;
alter table public.workspaces add column help_version integer not null default 1;

create function private.help_access() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
   'public', coalesce((select bool_and(help_public) from public.workspaces),false),
   'allowed', coalesce((select bool_and(help_public) from public.workspaces),false)
     or exists(select 1 from public.memberships where id=auth.uid() and status='active')
 )
$$;
create function public.help_access() returns jsonb
language sql stable security invoker set search_path='' as $$select private.help_access()$$;
revoke all on function private.help_access(),public.help_access() from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.help_access(),public.help_access() to anon,authenticated;

alter function private.snapshot(text,jsonb,uuid) rename to snapshot_before_help;
create function private.snapshot(v text,f jsonb,i uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;m public.memberships;
begin
 result:=private.snapshot_before_help(v,f,i);
 if v='configuration' then
   m:=private.me();
   result:=result||jsonb_build_object('helpSettings',(
     select jsonb_build_object('public',help_public,'version',help_version)
     from public.workspaces where id=m.workspace_id));
 end if;
 return result;
end$$;

alter function private.command(jsonb) rename to command_before_help;
create function private.command(c jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.memberships; current_version integer; old_public boolean; requested boolean;
begin
 if c->>'action'<>'save_help_access' then return private.command_before_help(c);end if;
 m:=private.me();
 if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 select help_version,help_public into current_version,old_public from public.workspaces where id=m.workspace_id for update;
 m:=private.me();
 if m.id is null or m.role<>'admin' then raise exception 'Configuration hanya untuk admin' using errcode='42501';end if;
 if jsonb_typeof(c->'data'->'public') is distinct from 'boolean' then raise exception 'Pilih akses halaman bantuan';end if;
 if (c->>'version')::integer is distinct from current_version then raise exception 'Pengaturan berubah. Muat ulang lalu coba lagi.' using errcode='40001';end if;
 requested:=(c->'data'->>'public')::boolean;
 update public.workspaces set help_public=requested,help_version=help_version+1 where id=m.workspace_id;
 insert into private.audit_events(workspace_id,actor,action,entity,metadata)
 values(m.workspace_id,m.id,'save_help_access',m.workspace_id::text,jsonb_build_object('before',old_public,'after',requested));
 return m.workspace_id;
end$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
revoke all on function private.snapshot_before_help(text,jsonb,uuid),private.snapshot(text,jsonb,uuid),private.command_before_help(jsonb),private.command(jsonb) from public,anon,authenticated;
grant execute on function private.snapshot(text,jsonb,uuid),private.command(jsonb) to authenticated;
notify pgrst,'reload schema';
