insert into public.workspaces(id,name,timezone) values('10000000-0000-4000-8000-000000000001','Travel OS','Asia/Jakarta') on conflict do nothing;
insert into public.finance_categories(id,name,direction) values
('in-0','Deposit Trip','in'),('in-1','Pelunasan Trip','in'),('in-2','Penerimaan Lainnya','in'),('in-3','Modal Pemilik','in'),('in-4','Pinjaman Diterima','in'),
('out-0','Transportasi','out'),('out-1','Akomodasi','out'),('out-2','Konsumsi','out'),('out-3','Tiket & Aktivitas','out'),('out-4','Guide/Vendor','out'),('out-5','Marketing','out'),('out-6','Operasional Umum','out'),('out-7','Refund Klien','out'),('out-8','Penarikan Pemilik','out'),('out-9','Pelunasan Pinjaman','out') on conflict do nothing;
