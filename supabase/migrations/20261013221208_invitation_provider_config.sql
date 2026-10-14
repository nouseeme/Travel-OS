alter table public.workspaces add column app_url text not null default 'http://127.0.0.1:3000';
alter table public.workspaces add constraint app_url_origin check(app_url ~ '^https?://[^/?#]+$');
notify pgrst, 'reload schema';
