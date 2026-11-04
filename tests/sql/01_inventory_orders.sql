-- Business-rule tests for the mixed inventory and order flow.
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

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.co'),
  ('00000000-0000-0000-0000-00000000000b', 'ventas@test.co'),
  ('00000000-0000-0000-0000-00000000000c', 'bodega@test.co'),
  ('00000000-0000-0000-0000-00000000000d', 'cliente@test.co');
insert into user_roles values
  ('00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'sales'),
  ('00000000-0000-0000-0000-00000000000c', 'inventory');

insert into brands (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'marca-x', 'Marca X');
insert into categories (id, slug, name) values ('20000000-0000-0000-0000-000000000001', 'test-cat', 'Test');
insert into suppliers (id, name) values ('30000000-0000-0000-0000-000000000001', 'Proveedor Test');

insert into products (id, slug, name, reference, brand_id, category_id, price, is_active, is_demo) values
  ('40000000-0000-0000-0000-000000000001', 'own-shoe', 'Own Shoe', 'REF-OWN', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 300000, true, false),
  ('40000000-0000-0000-0000-000000000002', 'supplier-shoe', 'Supplier Shoe', 'REF-SUP', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 400000, true, false),
  ('40000000-0000-0000-0000-000000000003', 'demo-shoe', 'Demo Shoe', 'REF-DEMO', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 100000, true, true),
  ('40000000-0000-0000-0000-000000000004', 'stale-shoe', 'Stale Shoe', 'REF-STALE', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 200000, true, false);

insert into product_variants (id, product_id, sku, size, color) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'OWN-40', '40', 'Negro'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'SUP-41', '41', 'Blanco'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'DEMO-42', '42', 'Rojo'),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', 'STALE-39', '39', 'Gris');

insert into inventory (variant_id, location, quantity, unit_cost) values
  ('50000000-0000-0000-0000-000000000001', 'bodega-principal', 2, 180000),
  ('50000000-0000-0000-0000-000000000003', 'bodega-principal', 5, 50000);
insert into supplier_stock (id, supplier_id, variant_id, supplier_cost, quantity_reported, is_available, lead_time_days, confirmed_at) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 250000, 3, true, 4, now()),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', 120000, 9, true, 4, now() - interval '30 days');
update store_settings set shipping_flat_rate = 15000, free_shipping_from = 500000;

-- ---------------------------------------------------------------------------
-- Visibility (anon)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('anon', '');
select pg_temp.assert((select count(*) from inventory) = 0, 'anon must not see inventory');
select pg_temp.assert((select count(*) from suppliers) = 0, 'anon must not see suppliers');
select pg_temp.assert((select count(*) from supplier_stock) = 0, 'anon must not see supplier costs');
select pg_temp.assert((select count(*) from products) = 4, 'anon sees active products');
select pg_temp.assert((select status from variant_availability where variant_id = '50000000-0000-0000-0000-000000000001') = 'available_now', 'own stock => available_now');
select pg_temp.assert((select status from variant_availability where variant_id = '50000000-0000-0000-0000-000000000002') = 'available_on_order', 'fresh supplier => on order');
select pg_temp.assert((select status from variant_availability where variant_id = '50000000-0000-0000-0000-000000000004') = 'sold_out', 'stale supplier confirmation => sold out');
select pg_temp.assert((select own_available from variant_availability where variant_id = '50000000-0000-0000-0000-000000000002') = 0, 'supplier stock never counted as own');
select pg_temp.expect_error($$insert into orders (number, customer_id, email, phone, first_name, last_name, department, city, address, payment_method, subtotal, shipping, total, idempotency_key) values ('X', gen_random_uuid(), 'a@b.co', '1', 'a', 'b', 'c', 'd', 'e', 'wompi', 1, 0, 1, 'k')$$, 'permission denied|row-level security');
select pg_temp.expect_error($$select confirm_payment('00000000-0000-0000-0000-000000000000', 'wompi', 'x', 1, 'approved')$$, 'permission denied|FORBIDDEN');
select pg_temp.expect_error($$select adjust_inventory('50000000-0000-0000-0000-000000000001', 'x', 'entry', 5)$$, 'permission denied|FORBIDDEN');

-- ---------------------------------------------------------------------------
-- Checkout rules
-- ---------------------------------------------------------------------------
create temp table r (k text primary key, v jsonb);
grant all on r to anon, authenticated, service_role;

select pg_temp.expect_error($$select create_order('{"idempotency_key":"demo-key-000000000001","payment_method":"wompi","customer":{"email":"c@test.co","first_name":"Ana","last_name":"Ruiz","phone":"3000000000","department":"Santander","city":"Bucaramanga","address":"Calle 1"},"items":[{"variant_id":"50000000-0000-0000-0000-000000000003","quantity":1}]}')$$, 'DEMO_PRODUCT_NOT_PURCHASABLE');
select pg_temp.expect_error($$select create_order('{"idempotency_key":"stale-key-00000000001","payment_method":"wompi","customer":{"email":"c@test.co","first_name":"Ana","last_name":"Ruiz","phone":"3000000000","department":"Santander","city":"Bucaramanga","address":"Calle 1"},"items":[{"variant_id":"50000000-0000-0000-0000-000000000004","quantity":1}]}')$$, 'OUT_OF_STOCK');
select pg_temp.expect_error($$select create_order('{"idempotency_key":"qty-key-0000000000001","payment_method":"wompi","customer":{"email":"c@test.co","first_name":"Ana","last_name":"Ruiz","phone":"3000000000","department":"Santander","city":"Bucaramanga","address":"Calle 1"},"items":[{"variant_id":"50000000-0000-0000-0000-000000000001","quantity":3}]}')$$, 'OUT_OF_STOCK');

-- Valid mixed order: 1 own + 2 on order
insert into r select 'o1', create_order('{"idempotency_key":"order-one-key-0000001","payment_method":"wompi","customer":{"email":"Cliente@Test.co","first_name":"Ana","last_name":"Ruiz","phone":"3000000000","department":"Santander","city":"Bucaramanga","address":"Calle 1"},"items":[{"variant_id":"50000000-0000-0000-0000-000000000001","quantity":1},{"variant_id":"50000000-0000-0000-0000-000000000002","quantity":2}]}');
select pg_temp.assert((select (v->>'total')::int from r where k = 'o1') = 300000 + 800000 + 0, 'price from DB, free shipping over threshold');
-- idempotent replay
select pg_temp.assert((create_order('{"idempotency_key":"order-one-key-0000001","payment_method":"wompi","customer":{"email":"c@test.co","first_name":"x","last_name":"y","phone":"1","department":"S","city":"B","address":"C"},"items":[{"variant_id":"50000000-0000-0000-0000-000000000001","quantity":1}]}')->>'duplicate')::boolean, 'idempotent replay');
select pg_temp.assert((select own_available from variant_availability where variant_id = '50000000-0000-0000-0000-000000000001') = 1, 'own unit reserved');
select pg_temp.assert((select supplier_available from variant_availability where variant_id = '50000000-0000-0000-0000-000000000002') = 1, 'supplier units committed');
-- anon cannot read the order back
select pg_temp.assert((select count(*) from orders) = 0, 'anon cannot list orders');
-- tracking needs the email
select pg_temp.assert(track_order((select v->>'number' from r where k = 'o1'), 'otro@test.co') is null, 'tracking requires matching email');
select pg_temp.assert(track_order((select v->>'number' from r where k = 'o1'), 'cliente@test.co')->>'status' = 'pending_payment', 'tracking works');

-- ---------------------------------------------------------------------------
-- Payment (service role = webhook)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.as_user('service_role', '');
select pg_temp.assert(confirm_payment((select (v->>'order_id')::uuid from r where k = 'o1'), 'wompi', 'tx-1', 1100000, 'approved')->>'status' = 'awaiting_supplier', 'paid with on-order items => awaiting_supplier');
-- replayed webhook is harmless
select pg_temp.assert((confirm_payment((select (v->>'order_id')::uuid from r where k = 'o1'), 'wompi', 'tx-1', 1100000, 'approved')->>'already_paid')::boolean, 'webhook replay idempotent');
reset role;
select pg_temp.assert((select quantity from inventory where variant_id = '50000000-0000-0000-0000-000000000001') = 1, 'sale deducted');
select pg_temp.assert((select reserved from inventory where variant_id = '50000000-0000-0000-0000-000000000001') = 0, 'reservation consumed');
select pg_temp.assert((select count(*) from inventory_movements where type = 'sale') = 1, 'sale movement logged');

-- Supplier confirmation by sales
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select pg_temp.assert(confirm_supplier_item((select id from order_items where sku = 'SUP-41'), true, 'Confirmado por WhatsApp')->>'status' = 'preparing', 'supplier confirmation => preparing');
select pg_temp.expect_error($$select set_order_status((select (v->>'order_id')::uuid from r where k = 'o1'), 'delivered')$$, 'INVALID_TRANSITION');
select record_shipment((select (v->>'order_id')::uuid from r where k = 'o1'), 'Servientrega', 'GUIA123');
select set_order_status((select (v->>'order_id')::uuid from r where k = 'o1'), 'delivered');
select pg_temp.assert((select status from orders where id = (select (v->>'order_id')::uuid from r where k = 'o1')) = 'delivered', 'delivered');
-- sales cannot adjust stock
select pg_temp.expect_error($$select adjust_inventory('50000000-0000-0000-0000-000000000001', 'bodega-principal', 'entry', 5)$$, 'FORBIDDEN');
reset role;

-- ---------------------------------------------------------------------------
-- Amount mismatch and expiry
-- ---------------------------------------------------------------------------
select pg_temp.as_user('anon', '');
insert into r select 'o2', create_order('{"idempotency_key":"order-two-key-0000001","payment_method":"wompi","customer":{"email":"b@test.co","first_name":"B","last_name":"C","phone":"3000000001","department":"Santander","city":"Bucaramanga","address":"Calle 2"},"items":[{"variant_id":"50000000-0000-0000-0000-000000000001","quantity":1}]}');
select pg_temp.assert((select (v->>'total')::int from r where k = 'o2') = 315000, 'flat shipping below threshold');
reset role;
select pg_temp.as_user('service_role', '');
select pg_temp.assert(confirm_payment((select (v->>'order_id')::uuid from r where k = 'o2'), 'wompi', 'tx-2', 1000, 'approved')->>'status' = 'incident', 'amount mismatch => incident');
reset role;
select pg_temp.assert((select reserved from inventory where variant_id = '50000000-0000-0000-0000-000000000001') = 1, 'incident keeps reservation for manual review');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select set_order_status((select (v->>'order_id')::uuid from r where k = 'o2'), 'cancelled', 'monto errado');
reset role;
select pg_temp.assert((select reserved from inventory where variant_id = '50000000-0000-0000-0000-000000000001') = 0, 'cancel releases reservation');

select pg_temp.as_user('anon', '');
insert into r select 'o3', create_order('{"idempotency_key":"order-three-key-00001","payment_method":"transfer","customer":{"email":"d@test.co","first_name":"D","last_name":"E","phone":"3000000002","department":"Santander","city":"Floridablanca","address":"Calle 3"},"items":[{"variant_id":"50000000-0000-0000-0000-000000000001","quantity":1}]}');
reset role;
update orders set reservation_expires_at = now() - interval '1 minute' where id = (select (v->>'order_id')::uuid from r where k = 'o3');
select pg_temp.assert(expire_reservations() = 1, 'expired order cancelled');
select pg_temp.assert((select reserved from inventory where variant_id = '50000000-0000-0000-0000-000000000001') = 0, 'expiry releases stock');
-- late payment on expired order goes to incident, never silently sold
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select pg_temp.assert(confirm_payment((select (v->>'order_id')::uuid from r where k = 'o3'), 'transfer', 'TRF-3', 315000, 'approved')->>'status' = 'incident', 'late payment => incident');
reset role;

-- ---------------------------------------------------------------------------
-- Inventory role
-- ---------------------------------------------------------------------------
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000c');
select pg_temp.assert(adjust_inventory('50000000-0000-0000-0000-000000000001', 'bodega-principal', 'entry', 4, 175000, 'Compra lote') = 5, 'entry adds stock');
select pg_temp.expect_error($$select adjust_inventory('50000000-0000-0000-0000-000000000001', 'bodega-principal', 'exit', 50)$$, 'check constraint|violates');
select confirm_supplier_stock('60000000-0000-0000-0000-000000000002', 6, true, 3, 118000, 'Llamada proveedor');
select pg_temp.assert((select count(*) from supplier_confirmations) = 2, 'confirmation history kept');
select pg_temp.assert((select count(*) from inventory) >= 1, 'inventory role reads inventory');
update store_settings set whatsapp_number = '573001112233'; -- RLS: affects 0 rows
reset role;
select pg_temp.assert((select whatsapp_number from store_settings) is null, 'inventory role cannot change settings');
select pg_temp.assert((select status from variant_availability where variant_id = '50000000-0000-0000-0000-000000000004') = 'available_on_order', 'reconfirmed supplier is available again');

-- Admin
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
update store_settings set whatsapp_number = '573001112233';
select pg_temp.assert((admin_dashboard_stats()->>'revenue_total')::int = 1100000, 'dashboard revenue counts only valid paid orders');
reset role;
select pg_temp.assert((select whatsapp_number from store_settings) = '573001112233', 'admin changes settings');
select pg_temp.assert((select count(*) from audit_logs where entity = 'store_settings') >= 1, 'settings change audited');
select pg_temp.assert((select count(*) from audit_logs where entity = 'orders' and action = 'STATUS') >= 3, 'order status changes audited');
