-- Keep existing authorization and snapshot wrappers. Filter and sort before LIMIT.
do $migration$
declare
  original text;
  definition text;
  anchor text := $anchor$(coalesce(filters->>'pic','')='' or j.data->>'pic'=filters->>'pic')$anchor$;
  predicate text := $predicate$
    and (view_name <> 'trips' or record_id is not null or filters->>'lifecycle'='archive' or (
      (coalesce(filters->>'trip_stage','')='' or j.data->>'stage'=filters->>'trip_stage')
      and (coalesce(filters->>'departure_from','')='' or nullif(j.data->>'start','') >= filters->>'departure_from')
      and (coalesce(filters->>'departure_to','')='' or nullif(j.data->>'start','') <= filters->>'departure_to')
    ))$predicate$;
  ordering text := $ordering$order by
    case when view_name='trips' and coalesce(filters->>'lifecycle','active')<>'archive' and coalesce(filters->>'trip_sort','nearest') in ('nearest','latest') then nullif(j.data->>'start','') is null else false end,
    case when view_name='trips' and coalesce(filters->>'lifecycle','active')<>'archive' and coalesce(filters->>'trip_sort','nearest')='nearest'
      then case when coalesce(nullif(j.data->>'end',''),nullif(j.data->>'start','')) >= (current_timestamp at time zone tz)::date::text then 0 else 1 end end,
    case when view_name='trips' and coalesce(filters->>'lifecycle','active')<>'archive' and coalesce(filters->>'trip_sort','nearest')='nearest'
      and coalesce(nullif(j.data->>'end',''),nullif(j.data->>'start','')) >= (current_timestamp at time zone tz)::date::text
      then j.data->>'start' end asc nulls last,
    case when view_name='trips' and coalesce(filters->>'lifecycle','active')<>'archive' and coalesce(filters->>'trip_sort','nearest') in ('nearest','latest')
      then nullif(j.data->>'start','') end desc nulls last,
    case when view_name='trips' and coalesce(filters->>'lifecycle','active')<>'archive' and filters->>'trip_sort'='name_asc' then lower(coalesce(nullif(j.data->>'name',''),j.data->>'client')) end asc,
    case when view_name='trips' and coalesce(filters->>'lifecycle','active')<>'archive' and filters->>'trip_sort'='name_desc' then lower(coalesce(nullif(j.data->>'name',''),j.data->>'client')) end desc,
    j.created_at desc, j.id
    limit 50 offset$ordering$;
begin
  original := pg_get_functiondef('private.snapshot_core(text,jsonb,uuid)'::regprocedure);
  if (length(original)-length(replace(original,anchor,'')))/length(anchor) <> 2
    or position('order by j.created_at desc limit 50 offset' in original)=0 then
    raise exception 'Trip snapshot anchors changed; review migration';
  end if;
  definition := replace(original,anchor,anchor || predicate);
  definition := replace(definition,'order by j.created_at desc limit 50 offset',ordering);
  execute definition;
end
$migration$;

notify pgrst, 'reload schema';
