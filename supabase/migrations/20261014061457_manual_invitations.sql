alter table private.invitations add column delivery_channel text not null default 'email' check(delivery_channel in ('email','manual'));
create function private.manual_invitation_ready(invitation_id uuid,generation_id uuid,provider_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.invitation_delivery(invitation_id,generation_id,provider_id,'sent');
 update private.invitations set delivery_channel='manual' where id=invitation_id and generation=generation_id and status='sent';
end$$;
create function public.manual_invitation_ready(invitation_id uuid,generation_id uuid,provider_id uuid) returns void language sql security invoker set search_path='' as $$select private.manual_invitation_ready(invitation_id,generation_id,provider_id)$$;
revoke all on function private.manual_invitation_ready(uuid,uuid,uuid),public.manual_invitation_ready(uuid,uuid,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.manual_invitation_ready(uuid,uuid,uuid),public.manual_invitation_ready(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
