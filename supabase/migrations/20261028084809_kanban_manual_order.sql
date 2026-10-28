-- Prerequisite: 20261026120000_trip_board_sort_filters.sql and every earlier
-- wrapper migration. Apply this file transactionally; query drift must abort it.
-- Personal ordering shares the existing owner-only preference policy. Existing
-- board/calendar preferences, business rows, invitations and audit are retained.
alter table public.user_preferences add column board_orders jsonb not null default '{}'
 check(jsonb_typeof(board_orders)='object');

create function private.board_position(board text,lane text,item uuid) returns bigint
language sql stable set search_path='' as $$
 select coalesce((select n from public.user_preferences p,
 jsonb_array_elements_text(coalesce(p.board_orders->board->lane,'[]')) with ordinality a(id,n)
 where p.user_id=auth.uid() and id=item::text limit 1),2147483647)
$$;
revoke all on function private.board_position(text,text,uuid) from public,anon,authenticated;

alter function private.command(jsonb) rename to command_before_board_order;
create function private.command(c jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships;j public.journeys;t public.tasks;
 d jsonb:=c->'data'; board text:=d->>'board';lane text:=d->>'column';
 item uuid:=(c->>'id')::uuid; ids uuid[]; previous jsonb;merged jsonb;current_lane text;
begin
 if c->>'action' is distinct from 'board_move' then return private.command_before_board_order(c);end if;
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform 1 from public.workspaces where id=m.workspace_id for update;
 m:=private.me();if m.id is null then raise exception 'Akses ditolak' using errcode='42501';end if;
 if board is null or board not in ('tasks','sales','trips') or coalesce(length(lane),0) not between 1 and 100
  or jsonb_typeof(d->'order') is distinct from 'array' then raise exception 'Urutan papan tidak valid';end if;
 if jsonb_array_length(d->'order') not between 1 and 150 then raise exception 'Urutan papan terlalu panjang';end if;
 select array_agg(x::uuid order by n) into ids
 from jsonb_array_elements_text(d->'order') with ordinality a(x,n);
 if item is null or not item=any(ids) or cardinality(ids)<>(select count(distinct x) from unnest(ids) x)
  or array_position(ids,null) is not null then raise exception 'Kartu urutan tidak valid';end if;
 if board='tasks' then
  select * into t from public.tasks where id=item and workspace_id=m.workspace_id for update;
  if t.id is null or t.data->>'cancelled_at' is not null or (t.parent is not null and not private.parent_allowed(t.parent))
   or not coalesce(t.assignee=m.id or private.allowed(m.workspace_id,case t.data->>'context' when 'lead' then 'sales' when 'trip' then 'trips' else null end,true),false) then
   raise exception 'Akses kartu ditolak' using errcode='42501';end if;
  if t.version is distinct from (c->>'version')::integer then raise exception 'Data berubah. Refresh sebelum menyimpan.' using errcode='40001';end if;
  current_lane:=t.data->>'status';
 else
  select * into j from public.journeys where id=item and workspace_id=m.workspace_id and kind=case board when 'sales' then 'lead' else 'trip' end for update;
  if j.id is null or j.data->>'lifecycle'<>'active' or not private.allowed(m.workspace_id,board,true) then
   raise exception 'Akses kartu ditolak' using errcode='42501';end if;
  if j.version is distinct from (c->>'version')::integer then raise exception 'Data berubah. Refresh sebelum menyimpan.' using errcode='40001';end if;
  current_lane:=j.data->>'stage';
 end if;
 -- A cross-column move uses the original command in this same transaction,
 -- preserving status validation, permission checks, versions and audit events.
 if current_lane<>lane then
  perform private.command_before_board_order(jsonb_build_object('action',case board when 'tasks' then 'task_status' else 'stage' end,
   'id',item,'version',c->'version','timezone',c->'timezone','data',jsonb_build_object(case board when 'tasks' then 'status' else 'stage' end,lane)));
 end if;
 if board='tasks' then
  if (select count(*) from public.tasks x where x.id=any(ids) and x.workspace_id=m.workspace_id and x.data->>'status'=lane
   and x.data->>'cancelled_at' is null and (x.parent is null or private.parent_allowed(x.parent))
   and (x.assignee=m.id or m.role='admin' or private.allowed(m.workspace_id,case x.data->>'context' when 'lead' then 'sales' when 'trip' then 'trips' else null end)))<>cardinality(ids) then
   raise exception 'Kartu urutan tidak tersedia' using errcode='42501';end if;
 else
  if (select count(*) from public.journeys x where x.id=any(ids) and x.workspace_id=m.workspace_id and x.kind=j.kind
   and x.data->>'lifecycle'='active' and x.data->>'stage'=lane)<>cardinality(ids) then raise exception 'Kartu urutan tidak tersedia' using errcode='42501';end if;
 end if;
 select coalesce(p.board_orders->board->lane,'[]') into previous from public.user_preferences p where user_id=m.id;
 -- Keep IDs outside the filtered/page subset; replacing the visible subset
 -- must not discard another column or the rest of the user's board.
 select d->'order'||coalesce(jsonb_agg(x order by n) filter(where not x::uuid=any(ids)),'[]') into merged
 from jsonb_array_elements_text(coalesce(previous,'[]')) with ordinality a(x,n);
 insert into public.user_preferences(user_id,board_orders) values(m.id,jsonb_build_object(board,jsonb_build_object(lane,merged)))
 on conflict(user_id) do update set board_orders=public.user_preferences.board_orders||jsonb_build_object(board,
  coalesce(public.user_preferences.board_orders->board,'{}')||jsonb_build_object(lane,merged));
 return item;
end$$;

alter function private.snapshot(text,jsonb,uuid) rename to snapshot_before_board_order;
create function private.snapshot(view_name text,filters jsonb,record_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare s jsonb;m public.memberships;begin
 s:=private.snapshot_before_board_order(view_name,filters,record_id);m:=private.me();
 return s||jsonb_build_object('boardOrders',coalesce((select board_orders from public.user_preferences where user_id=m.id),'{}'));
end$$;

-- Order the complete authorized data before pagination, in the existing owning
-- snapshot functions. Fail if their anchors drift instead of silently patching.
do $migration$
declare
 definition text;
 anchor text;
 occurrences integer;
 manual_ordering text := $ordering$order by
  case when record_id is null
   and coalesce(filters->>'lifecycle','active')<>'archive'
   and (
    view_name='sales'
    or (view_name='trips' and coalesce(
     filters->>'trip_sort',
     case when exists (
      select 1 from public.user_preferences
      where user_id=auth.uid() and coalesce(board_orders->'trips','{}')<>'{}'::jsonb
     ) then 'manual' else 'nearest' end
    )='manual')
   )
  then private.board_position(view_name,j.data->>'stage',j.id) end,
    case when view_name='trips'$ordering$;
begin
 definition:=pg_get_functiondef('private.snapshot_core(text,jsonb,uuid)'::regprocedure);
 anchor:='order by' || chr(10) || '    case when view_name=''trips''';
 occurrences:=(length(definition)-length(replace(definition,anchor,'')))/length(anchor);
 if occurrences<>1 then raise exception 'Journey sorting anchor changed (expected 1, found %)',occurrences;end if;
 definition:=replace(definition,anchor,manual_ordering);

 -- Both the row-number window and the outer task aggregate need the same rank.
 anchor:='order by case when v->>''status''=''Done''';
 occurrences:=(length(definition)-length(replace(definition,anchor,'')))/length(anchor);
 if occurrences<>2 then raise exception 'Core task sorting anchor changed (expected 2, found %)',occurrences;end if;
 definition:=replace(definition,anchor,'order by private.board_position(''tasks'',v->>''status'',(v->>''id'')::uuid),case when v->>''status''=''Done''');
 execute definition;

 definition:=pg_get_functiondef('private.snapshot_p1(text,jsonb,uuid)'::regprocedure);
 anchor:='partition by t.data->>''status'' order by';
 occurrences:=(length(definition)-length(replace(definition,anchor,'')))/length(anchor);
 if occurrences<>1 then raise exception 'Filtered task sorting anchor changed (expected 1, found %)',occurrences;end if;
 definition:=replace(definition,anchor,anchor||' private.board_position(''tasks'',t.data->>''status'',t.id),');
 execute definition;
end
$migration$;

create or replace function public.app_command(command jsonb) returns uuid language sql security invoker set search_path='' as $$select private.command(command)$$;
create or replace function public.app_snapshot(view_name text,filters jsonb default '{}',record_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.snapshot(view_name,filters,record_id)$$;
revoke all on function private.command_before_board_order(jsonb),private.command(jsonb),private.snapshot_before_board_order(text,jsonb,uuid),private.snapshot(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.command(jsonb),private.snapshot(text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
