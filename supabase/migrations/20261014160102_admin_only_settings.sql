-- Team and Settings are reserved for administrators, regardless of module edit rights.
alter function private.snapshot(text,jsonb,uuid) rename to snapshot_before_admin_settings;
create function private.snapshot(v text,f jsonb,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.memberships;begin
 m:=private.me();
 if m.id is null or (v in ('people','configuration','audit') and m.role<>'admin') then raise exception 'Team & Settings hanya untuk admin' using errcode='42501';end if;
 return private.snapshot_before_admin_settings(v,f,i);
end$$;
alter function private.command(jsonb) rename to command_before_admin_settings;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships;begin
 if c->>'action' in ('save_stage','retire_stage','save_trip_stage','retire_trip_stage','save_category') then
  m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
  perform 1 from public.workspaces where id=m.workspace_id for update;
  m:=private.me();if m.id is null or m.role<>'admin' then raise exception 'Configuration hanya untuk admin' using errcode='42501';end if;
 end if;
 return private.command_before_admin_settings(c);
end$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
revoke all on function private.snapshot_before_admin_settings(text,jsonb,uuid),private.snapshot(text,jsonb,uuid),private.command_before_admin_settings(jsonb),private.command(jsonb) from public,anon,authenticated;
grant execute on function private.snapshot(text,jsonb,uuid),private.command(jsonb) to authenticated;
notify pgrst,'reload schema';
