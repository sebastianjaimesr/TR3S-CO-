-- Supabase grants table privileges to API roles by default; RLS restricts rows.
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
