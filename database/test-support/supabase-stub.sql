-- Minimal stand-in for the Supabase auth schema so migrations can be tested
-- on a plain PostgreSQL. NOT for production.
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
$$ select current_setting('request.jwt.claims', true)::jsonb->>'role' $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
