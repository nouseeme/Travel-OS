-- Existing projects receive the same post-lock recheck as fresh installations.
do $$
declare original text;definition text;anchor text:='perform 1 from public.workspaces where id=m.workspace_id for update;';
begin
 original:=pg_get_functiondef('private.command(jsonb)'::regprocedure);
 if position('P2 membership recheck' in original)=0 then
  definition:=replace(original,anchor,anchor||E'\n /* P2 membership recheck */\n select fresh_member.* into m from public.memberships fresh_member where fresh_member.id=auth.uid() and fresh_member.status=''active'';\n if m.id is null then raise exception ''Akses ditolak'' using errcode=''42501'';end if;');
  if definition=original then raise exception 'P2 lock anchor missing';end if;
  execute definition;
 end if;
end$$;
