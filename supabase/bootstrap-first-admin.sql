-- First create a confirmed email/password user in Supabase Authentication > Users.
-- Replace YOUR_EMAIL and YOUR_NAME below, then run in this project's SQL Editor.
-- This script never creates or stores a password, and refuses if an active admin exists.
begin;
select id from public.workspaces where id='10000000-0000-4000-8000-000000000001' for update;
do $$
declare first_user auth.users; owner_email text := 'YOUR_EMAIL';
begin
 if exists(select 1 from public.memberships where role='admin' and status='active') then
  raise exception 'An active administrator already exists';
 end if;
 select * into first_user from auth.users where lower(email)=lower(owner_email);
 if first_user.id is null or first_user.email_confirmed_at is null or coalesce(first_user.encrypted_password,'')='' then
  raise exception 'Create a confirmed email/password Auth user first';
 end if;
 if coalesce((first_user.raw_app_meta_data->>'demo_fixture')::boolean,false) then
  raise exception 'Use a real owner account, not a fictional demo staff record';
 end if;
 insert into public.memberships(id,workspace_id,name,email,role,status,privileges)
 values(first_user.id,'10000000-0000-4000-8000-000000000001','YOUR_NAME',first_user.email,'admin','active',
 '{"sales":"edit","trips":"edit","finance":"edit","docs":"edit"}');
end $$;
commit;
