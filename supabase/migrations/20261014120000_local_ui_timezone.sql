-- UTC instants; request-local calendar boundaries. No stored dates are rewritten.
create function private.ui_timezone(value text) returns text language plpgsql stable set search_path='' as $$
declare tz text:=coalesce(nullif(value,''),'UTC');
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then raise exception 'Timezone tidak valid';end if;
 return tz;
end$$;
revoke all on function private.ui_timezone(text) from public,anon,authenticated;

-- Patch only timezone expressions, keeping earlier permission and audit fixes intact.
do $$
declare definition text;original text;
begin
 original:=pg_get_functiondef('private.snapshot_core(text,jsonb,uuid)'::regprocedure);
 definition:=replace(original,'select timezone into tz from public.workspaces where id=w;','tz:=private.ui_timezone(filters->>''timezone'');');
 if definition=original then raise exception 'snapshot timezone anchor missing';end if;
 execute definition;

 original:=pg_get_functiondef('private.insights(text,jsonb)'::regprocedure);
 definition:=replace(original,'select timezone into tz from public.workspaces where id=m.workspace_id;','tz:=private.ui_timezone(filters->>''timezone'');');
 if definition=original then raise exception 'insights timezone anchor missing';end if;
 execute definition;

 original:=pg_get_functiondef('private.command(jsonb)'::regprocedure);
 definition:=replace(original,'begin',E'begin\n perform pg_catalog.set_config(''app.ui_timezone'',private.ui_timezone(c->>''timezone''),true);');
 if definition=original then raise exception 'command timezone anchor missing';end if;
 execute definition;

 original:=pg_get_functiondef('private.check_transaction()'::regprocedure);
 definition:=replace(original,'(select timezone from public.workspaces where id=new.workspace_id)','private.ui_timezone(current_setting(''app.ui_timezone'',true))');
 if definition=original then raise exception 'transaction timezone anchor missing';end if;
 execute definition;
end$$;
alter function private.snapshot_core(text,jsonb,uuid) set timezone='UTC';
alter function private.snapshot(text,jsonb,uuid) set timezone='UTC';
alter function private.insights(text,jsonb) set timezone='UTC';
alter function private.command(jsonb) set timezone='UTC';
notify pgrst,'reload schema';
