-- Explicitly requested destructive demo reset for Travel OS only.
-- Run AFTER shared_contacts_relational. Safe to rerun as an intentional reset.
begin;
do $$begin
 if not exists(select 1 from public.workspaces where id='10000000-0000-4000-8000-000000000001' and name='Travel OS') then raise exception 'Travel OS workspace not found';end if;
end$$;
select id from public.workspaces where id='10000000-0000-4000-8000-000000000001' for update;

delete from public.contacts where workspace_id='10000000-0000-4000-8000-000000000001';
-- Remove frozen contact copies as well as the live records.
update private.contact_share_links set payload=jsonb_set(payload,'{contacts}','[]'),revoked_at=coalesce(revoked_at,now()) where workspace_id='10000000-0000-4000-8000-000000000001';
update private.share_snapshots s set payload=jsonb_set(s.payload,'{contacts}','[]') from private.share_links l where l.id=s.share_link_id and l.workspace_id='10000000-0000-4000-8000-000000000001';
update private.audit_events set metadata='{"contact_reset":true}' where workspace_id='10000000-0000-4000-8000-000000000001' and action in ('edit_contact','save_internal_contacts','delete_contacts','delete_contact','link_contacts');

insert into public.contacts(id,workspace_id,name,role,organization,email,note,internal_saved)
select md5('travel-os-dummy-contact-'||n)::uuid,'10000000-0000-4000-8000-000000000001',
 (array['Alya Pradana','Bima Santosa','Citra Wulandari','Damar Wijaya','Elena Kartika','Farhan Mahendra','Gita Larasati','Hadi Saputra','Intan Permata','Jaya Nugraha','Kirana Dewi','Laras Puspita','Maya Anindita','Naufal Wicaksana','Oki Ramadhan','Putri Amelia','Raka Aditya','Sari Kusuma','Tara Maharani','Umar Fadillah','Vina Anggraini','Wahyu Prasetyo','Yasmin Safira','Zaki Firmansyah'])[n],
 (array['Client PIC','Transport vendor','Accommodation vendor','Tour guide','Catering vendor','Event coordinator'])[1+(n-1)%6],
 'Demo Partner '||lpad(n::text,2,'0'),
 'contact.'||lpad(n::text,2,'0')||'@travel-os.example.test',
 'Data dummy fiktif untuk pengujian kontak bersama; bukan orang atau mitra nyata.',true
from generate_series(1,24) n;

with parents as (
 select id,workspace_id,dense_rank() over(order by coalesce(source_lead,id)) n from public.journeys where workspace_id='10000000-0000-4000-8000-000000000001'
)
insert into public.journey_contacts(workspace_id,journey_id,contact_id,position)
select workspace_id,id,md5('travel-os-dummy-contact-'||(1+(n-1+slot*8)%24))::uuid,slot from parents cross join generate_series(0,2) slot;
update public.journeys set version=version+1,updated_at=now() where workspace_id='10000000-0000-4000-8000-000000000001';
insert into private.contact_directory_state(workspace_id,version) values('10000000-0000-4000-8000-000000000001',2) on conflict(workspace_id) do update set version=private.contact_directory_state.version+1;
insert into private.audit_events(workspace_id,actor,action,entity,metadata)
select w.id,m.id,'reset_contacts',w.id::text,jsonb_build_object('dummy_contacts',24,'journeys',(select count(*) from public.journeys j where j.workspace_id=w.id))
from public.workspaces w cross join lateral(select id from public.memberships where workspace_id=w.id and role='admin' and status='active' order by id limit 1) m where w.id='10000000-0000-4000-8000-000000000001';
commit;
