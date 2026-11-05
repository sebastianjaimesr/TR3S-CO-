-- Delivery A: newsletter sign-up and public best-seller ranking.
-- Runs after 01/02 on the same database (reuses their users and paid orders).
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create or replace function pg_temp.as_user(p_role text, p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role)::text, false);
  execute format('set role %I', p_role);
end $$;
create or replace function pg_temp.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm !~ p_pattern then raise exception 'expected error % but got %', p_pattern, sqlerrm; end if;
    return;
  end;
  raise exception 'expected error % but statement succeeded: %', p_pattern, p_sql;
end $$;
create or replace function pg_temp.assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if not coalesce(p_ok, false) then raise exception 'ASSERTION FAILED: %', p_msg; end if; end $$;

-- Newsletter -------------------------------------------------------------------
select pg_temp.as_user('anon', '');
select pg_temp.assert(public.subscribe_newsletter('  Fan@Correo.CO ', 'home'), 'anon can subscribe');
select pg_temp.assert(public.subscribe_newsletter('fan@correo.co'), 'subscribing twice is silent');
select pg_temp.expect_error($$select public.subscribe_newsletter('no-es-correo')$$, 'invalid_email');
-- anon reads nothing (no grant in Supabase; RLS hides rows even if a grant exists) and cannot insert directly
select pg_temp.assert((select count(*) from newsletter_subscribers) = 0, 'anon sees no subscribers');
select pg_temp.expect_error($$insert into newsletter_subscribers (email) values ('x@y.co')$$, 'permission denied|row-level security');

-- a signed-in customer cannot read the list
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from newsletter_subscribers) = 0, 'customer sees no subscribers');

-- sales staff can
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from newsletter_subscribers where email = 'fan@correo.co') = 1, 'sales sees one normalised row');

-- inventory staff cannot
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from newsletter_subscribers) = 0, 'inventory role sees no subscribers');

-- re-subscribing after a baja reactivates it
reset role;
update newsletter_subscribers set unsubscribed_at = now() where email = 'fan@correo.co';
select pg_temp.as_user('anon', '');
select public.subscribe_newsletter('fan@correo.co');
reset role;
select pg_temp.assert((select unsubscribed_at is null from newsletter_subscribers where email = 'fan@correo.co'), 're-subscribe clears the baja');

-- Best sellers -----------------------------------------------------------------
select pg_temp.as_user('anon', '');
-- only paid orders of active products count, and only ids + units are exposed
select pg_temp.assert(
  (select bool_and(units > 0) from public.best_selling_products(8, 90)) is not false,
  'units are positive');
reset role;
select pg_temp.assert(
  (select count(*) from public.best_selling_products(8, 90) b join products p on p.id = b.product_id where not p.is_active) = 0,
  'inactive products are never ranked');
select pg_temp.assert(
  (select coalesce(sum(units), 0) from public.best_selling_products(24, 365)) =
  (select coalesce(sum(oi.quantity), 0) from order_items oi join orders o on o.id = oi.order_id
     join product_variants v on v.id = oi.variant_id join products p on p.id = v.product_id
     where o.payment_status = 'approved' and p.is_active and o.created_at >= now() - interval '365 days'),
  'units match approved orders');
