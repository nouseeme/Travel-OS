-- Owner overrides the PRD's original three-user assumption. Keep invitation
-- uniqueness, authorization, workspace locking and last-admin protection.
do $migration$
declare definition text;cap_line text:=$cap$   if (select count(*) from public.memberships where workspace_id=m.workspace_id and status='active')+(select count(*) from private.invitations where workspace_id=m.workspace_id and status not in ('accepted','revoked'))>=3 then raise exception 'Tiga slot sudah terisi';end if;$cap$;
begin
 definition:=pg_get_functiondef('private.command_core(jsonb)'::regprocedure);
 if position(cap_line in definition)=0 then raise exception 'Expected membership cap not found';end if;
 execute replace(definition,cap_line,'   -- No application member cap; infrastructure/provider limits still apply.');
end $migration$;
