-- Supabase's auto-RLS event trigger is not an application RPC.
do $$begin if to_regprocedure('public.rls_auto_enable()') is not null then execute 'revoke execute on function public.rls_auto_enable() from public,anon,authenticated';end if;end$$;
create index audit_workspace_time on private.audit_events(workspace_id,at desc,id);
create index invitation_actor on private.invitations(invited_by);
create index journey_source_fk on public.journeys(workspace_id,source_lead);
create index task_workspace_parent on public.tasks(workspace_id,parent);
create index template_workspace on public.templates(workspace_id);
create index transaction_category_fk on public.transactions(category_id,direction);
create index transaction_workspace_trip on public.transactions(workspace_id,trip);
alter policy task_read on public.tasks using(workspace_id=(select (private.me()).workspace_id) and ((parent is null and (assignee=(select auth.uid()) or private.admin(workspace_id))) or private.parent_allowed(parent)));
alter policy preference_read on public.user_preferences using(user_id=(select auth.uid()) and (select (private.me()).id) is not null);
