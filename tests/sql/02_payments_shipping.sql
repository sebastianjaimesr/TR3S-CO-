-- Phase 3: multi-provider payments, separate statuses, manual shipping and quotes.
-- Runs after 01_inventory_orders.sql on the same database (reuses its users).
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

-- Fixtures ---------------------------------------------------------------------
reset role;
insert into products (id, slug, name, reference, brand_id, category_id, price, is_active) values
  ('40000000-0000-0000-0000-0000000000a1', 'pay-shoe', 'Pay Shoe', 'REF-PAY', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 200000, true);
insert into product_variants (id, product_id, sku, size, color) values
  ('50000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1', 'PAY-40', '40', 'Negro');
insert into inventory (variant_id, location, quantity, unit_cost) values ('50000000-0000-0000-0000-0000000000a1', 'bodega-principal', 10, 100000);
update store_settings set shipping_flat_rate = 15000, free_shipping_from = null, payment_mercadopago_enabled = false, payment_payu_enabled = false;
create temp table r2 (k text primary key, v jsonb);
grant all on r2 to anon, authenticated, service_role;

create or replace function pg_temp.order_payload(p_key text, p_method text, p_dept text, p_city text) returns jsonb language sql as $$
  select jsonb_build_object('idempotency_key', p_key, 'payment_method', p_method,
    'customer', jsonb_build_object('email', 'pay@test.co', 'first_name', 'Pay', 'last_name', 'Er', 'phone', '3000000009',
                                   'department', p_dept, 'city', p_city, 'address', 'Calle 9'),
    'items', jsonb_build_array(jsonb_build_object('variant_id', '50000000-0000-0000-0000-0000000000a1', 'quantity', 1)));
$$;
grant execute on function pg_temp.order_payload(text, text, text, text) to anon, authenticated;

-- Providers are off until the admin enables them --------------------------------
select pg_temp.as_user('anon', '');
select pg_temp.expect_error($$select create_order(pg_temp.order_payload('mp-disabled-key-00001', 'mercadopago', 'Santander', 'Bucaramanga'))$$, 'PAYMENT_METHOD_DISABLED');
select pg_temp.expect_error($$select create_order(pg_temp.order_payload('payu-disabled-key-0001', 'payu', 'Santander', 'Bucaramanga'))$$, 'PAYMENT_METHOD_DISABLED');
select pg_temp.expect_error($$select create_order(pg_temp.order_payload('bad-method-key-000001', 'cash', 'Santander', 'Bucaramanga'))$$, 'PAYMENT_METHOD_DISABLED');
-- customers cannot touch shipping zones, quotes or shipments
select pg_temp.expect_error($$insert into shipping_rates (name, rate) values ('x', 1)$$, 'row-level security|permission denied');
select pg_temp.expect_error($$select set_shipping_quote(gen_random_uuid(), 1000)$$, 'permission denied|FORBIDDEN');
select pg_temp.expect_error($$select update_shipment(gen_random_uuid(), 'delivered')$$, 'permission denied|FORBIDDEN');
reset role;

-- Shipping zones (sales manages them) -------------------------------------------
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
insert into shipping_rates (name, department, city, rate, free_from) values ('Bucaramanga', 'Santander', 'Bucaramanga', 8000, 150000);
insert into shipping_rates (name, department, rate) values ('Santander', 'Santander', 12000);
insert into shipping_rates (name, department, requires_quote) values ('San Andrés', 'San Andrés y Providencia', true);
insert into shipping_rates (name, rate) values ('Resto del país', 18000);
reset role;
select pg_temp.assert((resolve_shipping('Santander', 'bucaramanga', 100000)->>'amount')::int = 8000, 'city zone wins');
select pg_temp.assert((resolve_shipping('Santander', 'Bucaramanga', 150000)->>'amount')::int = 0, 'zone free shipping');
select pg_temp.assert((resolve_shipping('Santander', 'Girón', 100000)->>'amount')::int = 12000, 'department zone');
select pg_temp.assert((resolve_shipping('Antioquia', 'Medellín', 100000)->>'amount')::int = 18000, 'rest of the country');
select pg_temp.assert((resolve_shipping('San Andrés y Providencia', 'San Andrés', 100000)->>'requires_quote')::boolean, 'quote zone');

-- Mercado Pago order, token, attempts, payment status ---------------------------
update store_settings set payment_mercadopago_enabled = true;
select pg_temp.as_user('anon', '');
insert into r2 select 'mp', create_order(pg_temp.order_payload('mp-order-key-0000001', 'mercadopago', 'Santander', 'Floridablanca'));
select pg_temp.assert((select (v->>'total')::int from r2 where k = 'mp') = 212000, 'server computes zone shipping');
select pg_temp.assert(length((select v->>'access_token' from r2 where k = 'mp')) = 64, 'order gets a 64-char access token');
select pg_temp.expect_error($$select start_order_payment((select v->>'number' from r2 where k = 'mp'), 'wrong-token', 'mercadopago')$$, 'ORDER_NOT_FOUND');
select pg_temp.expect_error($$select start_order_payment((select v->>'number' from r2 where k = 'mp'), (select v->>'access_token' from r2 where k = 'mp'), 'payu')$$, 'PAYMENT_METHOD_DISABLED');
insert into r2 select 'mp-a1', start_order_payment((select v->>'number' from r2 where k = 'mp'), (select v->>'access_token' from r2 where k = 'mp'), 'mercadopago');
select pg_temp.assert((select v->>'reference' from r2 where k = 'mp-a1') = (select v->>'number' from r2 where k = 'mp'), 'first attempt uses the order number');
select pg_temp.assert((select (v->>'total')::int from r2 where k = 'mp-a1') = 212000, 'amount to charge comes from the order');
insert into r2 select 'mp-a2', start_order_payment((select v->>'number' from r2 where k = 'mp'), (select v->>'access_token' from r2 where k = 'mp'), 'mercadopago');
select pg_temp.assert((select v->>'reference' from r2 where k = 'mp-a2') = (select v->>'number' from r2 where k = 'mp') || '-2', 'retry gets a unique reference');
-- anon cannot confirm payments
select pg_temp.expect_error($$select confirm_payment((select (v->>'order_id')::uuid from r2 where k = 'mp'), 'mercadopago', 'mp-1', 212000, 'approved')$$, 'permission denied|FORBIDDEN');
reset role;

select pg_temp.as_user('service_role', '');
select confirm_payment((select (v->>'order_id')::uuid from r2 where k = 'mp'), 'mercadopago', 'mp-1', 212000, 'declined');
select pg_temp.assert((select payment_status from orders where id = (select (v->>'order_id')::uuid from r2 where k = 'mp')) = 'declined', 'declined is visible on the order');
select pg_temp.assert((select status from orders where id = (select (v->>'order_id')::uuid from r2 where k = 'mp')) = 'pending_payment', 'declined payment keeps the order open to retry');
select pg_temp.assert(confirm_payment((select (v->>'order_id')::uuid from r2 where k = 'mp'), 'mercadopago', 'mp-2', 212000, 'approved')->>'status' = 'preparing', 'approved => preparing');
-- out-of-order "pending" after approval must not downgrade anything
select confirm_payment((select (v->>'order_id')::uuid from r2 where k = 'mp'), 'mercadopago', 'mp-2', 212000, 'pending');
select pg_temp.assert((select status from payments where transaction_id = 'mp-2') = 'approved', 'late pending does not overwrite approved');
select pg_temp.assert((select payment_status from orders where id = (select (v->>'order_id')::uuid from r2 where k = 'mp')) = 'approved', 'order payment status approved');
select pg_temp.assert((select payment_method from orders where id = (select (v->>'order_id')::uuid from r2 where k = 'mp')) = 'mercadopago', 'provider recorded');
select pg_temp.assert((select status from shipments where order_id = (select (v->>'order_id')::uuid from r2 where k = 'mp')) = 'preparing', 'shipment opened as preparing');
reset role;
select pg_temp.as_user('anon', '');
select pg_temp.expect_error($$select start_order_payment((select v->>'number' from r2 where k = 'mp'), (select v->>'access_token' from r2 where k = 'mp'), 'mercadopago')$$, 'ORDER_ALREADY_PAID');
reset role;

-- Manual shipping board ----------------------------------------------------------
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($$select update_shipment((select (v->>'order_id')::uuid from r2 where k = 'mp'), 'dispatched')$$, 'CARRIER_AND_TRACKING_REQUIRED');
select update_shipment((select (v->>'order_id')::uuid from r2 where k = 'mp'), 'dispatched', 'Coordinadora', 'CO-123', 'Sale hoy');
select pg_temp.assert((select status from orders where id = (select (v->>'order_id')::uuid from r2 where k = 'mp')) = 'shipped', 'dispatch moves order to shipped');
select update_shipment((select (v->>'order_id')::uuid from r2 where k = 'mp'), 'delivery_issue', null, null, 'Dirección incompleta');
select pg_temp.assert((select tracking_number from shipments where order_id = (select (v->>'order_id')::uuid from r2 where k = 'mp')) = 'CO-123', 'tracking kept across updates');
select update_shipment((select (v->>'order_id')::uuid from r2 where k = 'mp'), 'delivered', null, null, 'Recibió portería');
select pg_temp.assert((select status from orders where id = (select (v->>'order_id')::uuid from r2 where k = 'mp')) = 'delivered', 'delivery closes the order');
select pg_temp.assert((select count(*) from shipment_events where order_id = (select (v->>'order_id')::uuid from r2 where k = 'mp')) = 4, 'shipment history');
reset role;
select pg_temp.as_user('anon', '');
select pg_temp.assert((select count(*) from shipment_events) = 0, 'anon cannot read shipment events');
select pg_temp.assert(track_order((select v->>'number' from r2 where k = 'mp'), 'pay@test.co')->'shipment'->>'status' = 'delivered', 'tracking shows shipment status');
select pg_temp.assert(track_order((select v->>'number' from r2 where k = 'mp'), 'pay@test.co')->>'payment_status' = 'approved', 'tracking shows payment status');
select pg_temp.assert(track_order((select v->>'number' from r2 where k = 'mp'), 'otro@test.co') is null, 'tracking needs the right email');
reset role;

-- Refund / chargeback of an approved payment => incident
select pg_temp.as_user('service_role', '');
select pg_temp.assert(confirm_payment((select (v->>'order_id')::uuid from r2 where k = 'mp'), 'mercadopago', 'mp-2', 212000, 'voided')->>'status' = 'incident', 'reversal flags the order');
reset role;

-- Shipping quote flow: nothing is charged before the customer accepts -----------
select pg_temp.as_user('anon', '');
insert into r2 select 'q', create_order(pg_temp.order_payload('quote-order-key-00001', 'wompi', 'San Andrés y Providencia', 'San Andrés'));
select pg_temp.assert((select v->>'shipping_quote_status' from r2 where k = 'q') = 'pending', 'quote pending');
select pg_temp.assert((select (v->>'total')::int from r2 where k = 'q') = 200000, 'no shipping charged yet');
select pg_temp.expect_error($$select start_order_payment((select v->>'number' from r2 where k = 'q'), (select v->>'access_token' from r2 where k = 'q'), 'wompi')$$, 'SHIPPING_QUOTE_PENDING');
select pg_temp.expect_error($$select accept_shipping_quote((select v->>'number' from r2 where k = 'q'), (select v->>'access_token' from r2 where k = 'q'))$$, 'QUOTE_NOT_READY');
reset role;
select pg_temp.assert((select reservation_expires_at > now() + interval '70 hours' from orders where id = (select (v->>'order_id')::uuid from r2 where k = 'q')), 'quote orders keep stock reserved longer');
-- paying before accepting is never accepted silently
select pg_temp.as_user('service_role', '');
reset role;
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($$select set_shipping_quote((select (v->>'order_id')::uuid from r2 where k = 'q'), -5)$$, 'INVALID_AMOUNT');
select set_shipping_quote((select (v->>'order_id')::uuid from r2 where k = 'q'), 45000, 'Envío aéreo');
reset role;
select pg_temp.assert((select total from orders where id = (select (v->>'order_id')::uuid from r2 where k = 'q')) = 245000, 'quote updates total');
select pg_temp.as_user('anon', '');
select pg_temp.expect_error($$select start_order_payment((select v->>'number' from r2 where k = 'q'), (select v->>'access_token' from r2 where k = 'q'), 'wompi')$$, 'SHIPPING_QUOTE_PENDING');
select pg_temp.expect_error($$select accept_shipping_quote((select v->>'number' from r2 where k = 'q'), 'nope')$$, 'ORDER_NOT_FOUND');
select accept_shipping_quote((select v->>'number' from r2 where k = 'q'), (select v->>'access_token' from r2 where k = 'q'));
insert into r2 select 'q-a1', start_order_payment((select v->>'number' from r2 where k = 'q'), (select v->>'access_token' from r2 where k = 'q'), 'wompi');
select pg_temp.assert((select (v->>'total')::int from r2 where k = 'q-a1') = 245000, 'charge includes accepted shipping');
reset role;
select pg_temp.as_user('service_role', '');
select pg_temp.assert(confirm_payment((select (v->>'order_id')::uuid from r2 where k = 'q'), 'wompi', 'wq-1', 245000, 'approved')->>'status' = 'preparing', 'accepted quote can be paid');
reset role;

-- Payment before accepting a quote goes to review
select pg_temp.as_user('anon', '');
insert into r2 select 'q2', create_order(pg_temp.order_payload('quote-order-key-00002', 'wompi', 'San Andrés y Providencia', 'San Andrés'));
reset role;
select pg_temp.as_user('service_role', '');
select pg_temp.assert(confirm_payment((select (v->>'order_id')::uuid from r2 where k = 'q2'), 'wompi', 'wq-2', 200000, 'approved')->>'status' = 'incident', 'payment before quote acceptance => incident');
reset role;

-- Home media: public read, admin write
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($$insert into home_media (slot, image_url) values ('hero', 'https://x/y.jpg')$$, 'row-level security');
reset role;
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
insert into home_media (slot, image_url, alt) values ('hero', 'https://x/y.jpg', 'Foto');
select pg_temp.assert((admin_dashboard_stats()->>'payments_approved')::int >= 2, 'dashboard counts approved payments');
reset role;
select pg_temp.as_user('anon', '');
select pg_temp.assert((select count(*) from home_media) = 1, 'anon reads home media');
select pg_temp.assert((select count(*) from webhook_events) = 0, 'anon cannot read payment events');
reset role;
