insert into public.workspaces(id,name,timezone) values('10000000-0000-4000-8000-000000000001','Travel OS','Asia/Jakarta') on conflict do nothing;
insert into public.finance_categories(id,name,direction) values
('in-0','Uang muka pelanggan','in'),('in-1','Pelunasan jasa perjalanan','in'),('in-2','Pendapatan lain-lain','in'),('in-3','Modal Pemilik','in'),('in-4','Pinjaman Diterima','in'),
('out-0','Beban transportasi','out'),('out-1','Beban akomodasi','out'),('out-2','Beban konsumsi','out'),('out-3','Beban tiket dan aktivitas','out'),('out-4','Beban jasa guide dan vendor','out'),('out-5','Beban pemasaran','out'),('out-6','Beban operasional','out'),('out-7','Pengembalian dana pelanggan','out'),('out-8','Penarikan Pemilik','out'),('out-9','Pelunasan Pinjaman','out') on conflict do nothing;
