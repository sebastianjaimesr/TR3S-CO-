-- TR3S & CO. — Fase 3: pagos multipasarela, estados separados (pago / pedido / envío),
-- envíos manuales por zona con cotización, token de acceso al pedido y contenido del inicio.
-- Additive and idempotent: safe to run on a database that already has 0001–0005.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  create type shipment_status as enum (
    'pending_quote',   -- cost not defined yet: nothing is charged
    'preparing',
    'dispatched',
    'in_transit',
    'delivered',
    'delivery_issue'   -- "novedad de entrega"
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Settings: one switch per provider (credentials stay in env vars)
-- ---------------------------------------------------------------------------
alter table store_settings
  add column if not exists payment_mercadopago_enabled boolean not null default false,
  add column if not exists payment_payu_enabled boolean not null default false,
  -- what to do when no shipping zone matches the address
  add column if not exists shipping_unmatched_mode text not null default 'flat',
  add column if not exists quote_reservation_hours integer not null default 72,
  add column if not exists store_description text;
do $$ begin
  alter table store_settings add constraint store_settings_unmatched_chk check (shipping_unmatched_mode in ('flat', 'quote'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table store_settings add constraint store_settings_quote_hours_chk check (quote_reservation_hours between 24 and 168);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shipping zones / rates (manual, no carrier APIs)
-- department null = rest of the country; city requires a department.
-- ---------------------------------------------------------------------------
create table if not exists shipping_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text,
  city text,
  rate integer not null default 0 check (rate >= 0),
  free_from integer check (free_from is null or free_from > 0),
  requires_quote boolean not null default false,
  eta_text text,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_rates_city_needs_dept check (city is null or department is not null)
);
create unique index if not exists shipping_rates_zone_uq
  on shipping_rates (lower(coalesce(department, '*')), lower(coalesce(city, '*')));

-- ---------------------------------------------------------------------------
-- Orders: separate payment status, shipping quote, secure access token
-- ---------------------------------------------------------------------------
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('wompi', 'transfer', 'mercadopago', 'payu'));

alter table orders
  add column if not exists payment_status payment_status not null default 'pending',
  add column if not exists shipping_quote_status text not null default 'not_required',
  add column if not exists shipping_rate_id uuid references shipping_rates(id) on delete set null,
  add column if not exists shipping_zone text,
  add column if not exists shipping_quoted_at timestamptz,
  add column if not exists shipping_accepted_at timestamptz,
  add column if not exists payment_attempts integer not null default 0,
  -- 64 hex chars from two CSPRNG v4 UUIDs; used in the customer's order link
  add column if not exists access_token text not null
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
do $$ begin
  alter table orders add constraint orders_quote_status_chk check (shipping_quote_status in ('not_required', 'pending', 'quoted', 'accepted'));
exception when duplicate_object then null; end $$;
create unique index if not exists orders_access_token_uq on orders (access_token);
create index if not exists orders_payment_status_idx on orders (payment_status, created_at desc);
update orders set payment_status = 'approved' where paid_at is not null and payment_status <> 'approved';

alter table payments drop constraint if exists payments_provider_check;
alter table payments add constraint payments_provider_check
  check (provider in ('wompi', 'transfer', 'mercadopago', 'payu'));
alter table payments add column if not exists updated_at timestamptz not null default now();

-- Payment events log (webhooks): outcome of every notification, including rejected ones.
alter table webhook_events
  add column if not exists status text not null default 'received',
  add column if not exists error text,
  add column if not exists order_number text,
  add column if not exists processed_at timestamptz;
do $$ begin
  alter table webhook_events add constraint webhook_events_status_chk
    check (status in ('received', 'processed', 'ignored', 'rejected', 'error'));
exception when duplicate_object then null; end $$;
create index if not exists webhook_events_received_idx on webhook_events (received_at desc);

-- ---------------------------------------------------------------------------
-- Shipments: status of the delivery, independent from payment and order status
-- ---------------------------------------------------------------------------
alter table shipments alter column carrier drop not null;
alter table shipments alter column tracking_number drop not null;
alter table shipments alter column shipped_at drop not null;
alter table shipments alter column shipped_at drop default;
alter table shipments
  add column if not exists status shipment_status not null default 'preparing',
  add column if not exists estimated_delivery date,
  add column if not exists shipping_cost integer check (shipping_cost is null or shipping_cost >= 0),
  add column if not exists updated_at timestamptz not null default now();
update shipments set status = case when delivered_at is not null then 'delivered'::shipment_status else 'dispatched'::shipment_status end
 where shipped_at is not null and status = 'preparing';

create table if not exists shipment_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  status shipment_status not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists shipment_events_order_idx on shipment_events (order_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Home page media slots (hero, categories, banners). Images uploaded by admin.
-- ---------------------------------------------------------------------------
create table if not exists home_media (
  slot text primary key check (slot ~ '^[a-z0-9-]+$'),
  image_url text,
  alt text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shipping resolution (also used by the checkout to show the cost)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_shipping(p_department text, p_city text, p_subtotal int)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare r shipping_rates; s store_settings;
begin
  select * into s from store_settings where id = 1;
  select * into r from shipping_rates
   where is_active
     and (department is null
          or (lower(department) = lower(coalesce(p_department, '')) and (city is null or lower(city) = lower(coalesce(p_city, '')))))
   order by (city is not null) desc, (department is not null) desc, position
   limit 1;
  if found then
    if r.requires_quote then
      return jsonb_build_object('rate_id', r.id, 'zone', r.name, 'requires_quote', true, 'amount', null, 'eta', r.eta_text);
    end if;
    return jsonb_build_object('rate_id', r.id, 'zone', r.name, 'requires_quote', false, 'eta', r.eta_text,
      'amount', case when r.free_from is not null and p_subtotal >= r.free_from then 0 else r.rate end);
  end if;
  if s.shipping_unmatched_mode = 'quote' then
    return jsonb_build_object('rate_id', null, 'zone', null, 'requires_quote', true, 'amount', null, 'eta', null);
  end if;
  return jsonb_build_object('rate_id', null, 'zone', null, 'requires_quote', false, 'eta', null,
    'amount', case when s.free_shipping_from is not null and p_subtotal >= s.free_shipping_from then 0 else s.shipping_flat_rate end);
end $$;

-- ---------------------------------------------------------------------------
-- create_order (replaces 0002): multi-provider, zone shipping, quotes, token.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_key text := p->>'idempotency_key';
  v_method text := p->>'payment_method';
  v_c jsonb := p->'customer';
  v_existing orders;
  v_settings store_settings;
  v_customer_id uuid;
  v_order_id uuid := gen_random_uuid();
  v_number text;
  v_subtotal int := 0;
  v_shipping int;
  v_ship jsonb;
  v_quote boolean;
  v_discount int := 0;
  v_coupon coupons;
  v_item record;
  v_row record;
  v_inv inventory;
  v_sup supplier_stock;
  v_price int;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_status order_status;
  v_token text;
begin
  if v_key is null or length(v_key) < 16 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;

  select * into v_existing from orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'number', v_existing.number,
      'total', v_existing.total, 'status', v_existing.status, 'duplicate', true,
      'access_token', v_existing.access_token, 'shipping_quote_status', v_existing.shipping_quote_status);
  end if;

  perform expire_reservations();

  select * into v_settings from store_settings where id = 1;
  if v_method is null or v_method not in ('wompi', 'transfer', 'mercadopago', 'payu') then raise exception 'PAYMENT_METHOD_DISABLED'; end if;
  if (v_method = 'wompi' and not v_settings.payment_wompi_enabled)
     or (v_method = 'transfer' and not v_settings.payment_transfer_enabled)
     or (v_method = 'mercadopago' and not v_settings.payment_mercadopago_enabled)
     or (v_method = 'payu' and not v_settings.payment_payu_enabled) then
    raise exception 'PAYMENT_METHOD_DISABLED';
  end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'EMPTY_CART'; end if;
  if jsonb_array_length(p->'items') > 20 then raise exception 'TOO_MANY_ITEMS'; end if;

  -- Aggregate duplicates and lock in a deterministic order to avoid deadlocks.
  for v_item in
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'quantity')::int)::int as quantity
    from jsonb_array_elements(p->'items') e
    group by 1 order by 1
  loop
    if v_item.quantity < 1 or v_item.quantity > 10 then raise exception 'INVALID_QUANTITY'; end if;

    select v.id, v.sku, v.size, v.color, v.price as v_price, v.is_active as v_active,
           pr.name, pr.price as p_price, pr.is_active as p_active, pr.is_demo, b.name as brand_name
      into v_row
      from product_variants v
      join products pr on pr.id = v.product_id
      join brands b on b.id = pr.brand_id
     where v.id = v_item.variant_id
     for share of v;
    if not found or not v_row.v_active or not v_row.p_active then raise exception 'VARIANT_UNAVAILABLE:%', v_item.variant_id; end if;
    if v_row.is_demo then raise exception 'DEMO_PRODUCT_NOT_PURCHASABLE:%', v_row.sku; end if;

    v_price := coalesce(v_row.v_price, v_row.p_price);

    select * into v_inv from inventory
      where variant_id = v_item.variant_id and quantity - reserved >= v_item.quantity
      order by quantity - reserved desc, location
      limit 1
      for update;

    if found then
      v_line := jsonb_build_object('variant_id', v_item.variant_id, 'quantity', v_item.quantity,
        'fulfillment', 'own', 'location', v_inv.location, 'unit_cost', v_inv.unit_cost,
        'price', v_price, 'sku', v_row.sku, 'size', v_row.size, 'color', v_row.color,
        'name', v_row.name, 'brand', v_row.brand_name);
    else
      select ss.* into v_sup from supplier_stock ss
        join suppliers s on s.id = ss.supplier_id and s.is_active
       where ss.variant_id = v_item.variant_id
         and ss.is_available
         and ss.quantity_reported >= v_item.quantity
         and ss.confirmed_at > now() - make_interval(days => v_settings.supplier_confirmation_max_age_days)
       order by ss.lead_time_days, ss.supplier_cost
       limit 1
       for update of ss;
      if not found then raise exception 'OUT_OF_STOCK:%', v_row.sku; end if;
      v_line := jsonb_build_object('variant_id', v_item.variant_id, 'quantity', v_item.quantity,
        'fulfillment', 'on_order', 'supplier_stock_id', v_sup.id, 'unit_cost', v_sup.supplier_cost,
        'lead_time_days', v_sup.lead_time_days,
        'price', v_price, 'sku', v_row.sku, 'size', v_row.size, 'color', v_row.color,
        'name', v_row.name, 'brand', v_row.brand_name);
    end if;

    v_subtotal := v_subtotal + v_price * v_item.quantity;
    v_lines := v_lines || v_line;
  end loop;

  if coalesce(p->>'coupon_code', '') <> '' then
    select * into v_coupon from coupons
     where code = upper(p->>'coupon_code') and is_active
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at > now())
       and (max_uses is null or used_count < max_uses)
     for update;
    if not found or v_subtotal < v_coupon.min_subtotal then raise exception 'INVALID_COUPON'; end if;
    v_discount := case when v_coupon.kind = 'percent'
                       then (v_subtotal * v_coupon.value) / 100
                       else least(v_coupon.value, v_subtotal) end;
    update coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;

  -- Shipping is always computed here, never taken from the browser.
  v_ship := resolve_shipping(v_c->>'department', v_c->>'city', v_subtotal - v_discount);
  v_quote := coalesce((v_ship->>'requires_quote')::boolean, false);
  v_shipping := case when v_quote then 0 else (v_ship->>'amount')::int end;

  insert into customers (email, first_name, last_name, phone, department, city, address, user_id)
  values (lower(v_c->>'email'), v_c->>'first_name', v_c->>'last_name', v_c->>'phone',
          v_c->>'department', v_c->>'city', v_c->>'address', auth.uid())
  on conflict (lower(email)) do update
     set first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone,
         department = excluded.department, city = excluded.city, address = excluded.address,
         user_id = coalesce(customers.user_id, excluded.user_id), updated_at = now()
     where customers.user_id is null or customers.user_id = auth.uid()
  returning id into v_customer_id;
  if v_customer_id is null then
    select id into v_customer_id from customers where lower(email) = lower(v_c->>'email');
  end if;

  v_number := 'T3-' || to_char(now() at time zone 'America/Bogota', 'YYMMDD') || '-' || nextval('order_number_seq');
  v_status := case when v_method = 'transfer' and not v_quote then 'awaiting_transfer'::order_status else 'pending_payment'::order_status end;

  insert into orders (id, number, customer_id, user_id, email, phone, first_name, last_name, department, city,
                      address, address_notes, status, payment_method, subtotal, shipping, discount, total,
                      coupon_code, idempotency_key, reservation_expires_at,
                      shipping_quote_status, shipping_rate_id, shipping_zone)
  values (v_order_id, v_number, v_customer_id, auth.uid(), lower(v_c->>'email'), v_c->>'phone',
          v_c->>'first_name', v_c->>'last_name', v_c->>'department', v_c->>'city', v_c->>'address',
          nullif(v_c->>'address_notes', ''), v_status,
          v_method, v_subtotal, v_shipping, v_discount, v_subtotal - v_discount + v_shipping,
          case when v_discount > 0 then upper(p->>'coupon_code') end, v_key,
          now() + case when v_quote then make_interval(hours => v_settings.quote_reservation_hours)
                       when v_method = 'transfer' then interval '48 hours'
                       else interval '60 minutes' end,
          case when v_quote then 'pending' else 'not_required' end,
          (v_ship->>'rate_id')::uuid, v_ship->>'zone')
  returning access_token into v_token;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into order_items (order_id, variant_id, product_name, brand_name, sku, size, color, unit_price, quantity,
                             fulfillment_type, location, supplier_stock_id, unit_cost, lead_time_days)
    values (v_order_id, (v_line->>'variant_id')::uuid, v_line->>'name', v_line->>'brand', v_line->>'sku',
            v_line->>'size', v_line->>'color', (v_line->>'price')::int, (v_line->>'quantity')::int,
            (v_line->>'fulfillment')::fulfillment_type, v_line->>'location',
            (v_line->>'supplier_stock_id')::uuid, (v_line->>'unit_cost')::int, (v_line->>'lead_time_days')::int);

    if v_line->>'fulfillment' = 'own' then
      update inventory set reserved = reserved + (v_line->>'quantity')::int, updated_at = now()
       where variant_id = (v_line->>'variant_id')::uuid and location = v_line->>'location';
      insert into inventory_movements (variant_id, location, type, quantity, order_id, note)
      values ((v_line->>'variant_id')::uuid, v_line->>'location', 'reservation', (v_line->>'quantity')::int, v_order_id, 'Reserva por pedido ' || v_number);
    else
      update supplier_stock set quantity_reported = quantity_reported - (v_line->>'quantity')::int, updated_at = now()
       where id = (v_line->>'supplier_stock_id')::uuid;
    end if;
  end loop;

  insert into order_events (order_id, status, note)
  values (v_order_id, v_status, case when v_quote then 'Pedido creado · envío pendiente de cotización (no se cobra hasta aceptarla)' else 'Pedido creado' end);
  if v_quote then
    insert into shipment_events (order_id, status, note) values (v_order_id, 'pending_quote', 'Esperando cotización del envío');
  end if;

  return jsonb_build_object('order_id', v_order_id, 'number', v_number,
    'total', v_subtotal - v_discount + v_shipping, 'subtotal', v_subtotal, 'shipping', v_shipping,
    'discount', v_discount, 'duplicate', false, 'access_token', v_token,
    'shipping_quote_status', case when v_quote then 'pending' else 'not_required' end);
end $$;

-- ---------------------------------------------------------------------------
-- start_order_payment: the only door to a payment attempt. Validates the
-- customer's token, the reservation and the quote, and returns the amount the
-- server will charge plus a unique provider reference for this attempt.
-- ---------------------------------------------------------------------------
create or replace function public.start_order_payment(p_number text, p_token text, p_method text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare o orders; s store_settings; v_ref text;
begin
  select * into o from orders where number = upper(trim(p_number)) for update;
  if not found or o.access_token <> coalesce(p_token, '') then raise exception 'ORDER_NOT_FOUND'; end if;
  select * into s from store_settings where id = 1;
  if p_method is null or p_method not in ('wompi', 'transfer', 'mercadopago', 'payu')
     or (p_method = 'wompi' and not s.payment_wompi_enabled)
     or (p_method = 'transfer' and not s.payment_transfer_enabled)
     or (p_method = 'mercadopago' and not s.payment_mercadopago_enabled)
     or (p_method = 'payu' and not s.payment_payu_enabled) then
    raise exception 'PAYMENT_METHOD_DISABLED';
  end if;
  if o.payment_status = 'approved' or o.paid_at is not null then raise exception 'ORDER_ALREADY_PAID'; end if;
  if o.status not in ('pending_payment', 'awaiting_transfer') then raise exception 'ORDER_NOT_PAYABLE:%', o.status; end if;
  if o.shipping_quote_status in ('pending', 'quoted') then raise exception 'SHIPPING_QUOTE_PENDING'; end if;
  if o.reservation_expires_at is not null and o.reservation_expires_at < now() + interval '5 minutes' then
    raise exception 'RESERVATION_EXPIRED';
  end if;
  if o.total <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  update orders
     set payment_method = p_method,
         status = case when p_method = 'transfer' then 'awaiting_transfer'::order_status else 'pending_payment'::order_status end,
         payment_attempts = payment_attempts + 1,
         -- moving from transfer (48 h) to an online gateway shortens the hold
         reservation_expires_at = case when p_method <> 'transfer' and o.shipping_quote_status = 'not_required'
                                       then least(reservation_expires_at, now() + interval '60 minutes')
                                       else reservation_expires_at end,
         updated_at = now()
   where id = o.id
  returning * into o;
  v_ref := case when o.payment_attempts <= 1 then o.number else o.number || '-' || o.payment_attempts end;
  if o.payment_attempts > 1 or o.status::text <> 'pending_payment' then
    insert into order_events (order_id, status, note) values (o.id, o.status, 'Inicio de pago (' || p_method || ') · intento ' || o.payment_attempts);
  end if;
  return jsonb_build_object('order_id', o.id, 'number', o.number, 'reference', v_ref, 'total', o.total,
    'email', o.email, 'first_name', o.first_name, 'last_name', o.last_name, 'phone', o.phone,
    'method', p_method, 'expires_at', o.reservation_expires_at);
end $$;

-- ---------------------------------------------------------------------------
-- confirm_payment (replaces 0002): any provider, keeps order.payment_status in
-- sync, out-of-order safe, never pays an order whose shipping is not accepted.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_order_id uuid, p_provider text, p_transaction_id text, p_amount int, p_status payment_status, p_raw jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare o orders; it record; v_has_on_order boolean; v_new order_status; v_prev payment_status;
begin
  if not (is_service() or has_role(array['sales'])) then raise exception 'FORBIDDEN'; end if;

  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  select status into v_prev from payments where provider = p_provider and transaction_id = p_transaction_id;

  insert into payments (order_id, provider, transaction_id, status, amount, raw, verified_by)
  values (p_order_id, p_provider, p_transaction_id, p_status, p_amount, p_raw, auth.uid())
  on conflict (provider, transaction_id) do update
     set status = case when payments.status = 'approved' and excluded.status = 'pending' then payments.status else excluded.status end,
         raw = case when payments.status = 'approved' and excluded.status = 'pending' then payments.raw else excluded.raw end,
         updated_at = now();

  if p_status <> 'approved' then
    if v_prev = 'approved' and p_status in ('voided', 'declined', 'error') then
      -- refund / chargeback / reversal of a payment we had accepted
      update orders set payment_status = 'voided', status = case when status in ('cancelled', 'delivered') then status else 'incident' end, updated_at = now() where id = p_order_id;
      insert into order_events (order_id, status, note) values (p_order_id, 'incident', 'Pago aprobado fue revertido (' || p_provider || ' · ' || p_status || '): revisar');
      return jsonb_build_object('status', 'incident');
    end if;
    if o.payment_status <> 'approved' and p_status is distinct from v_prev then
      update orders set payment_status = p_status, updated_at = now() where id = p_order_id;
      insert into order_events (order_id, status, note, created_by)
      values (p_order_id, o.status, 'Pago ' || p_status || ' (' || p_provider || ')', auth.uid());
    end if;
    return jsonb_build_object('status', o.status, 'payment_status', p_status);
  end if;

  if o.status not in ('pending_payment', 'awaiting_transfer') then
    if o.paid_at is not null then
      return jsonb_build_object('status', o.status, 'already_paid', true);
    end if;
    update orders set status = 'incident', payment_status = 'approved', updated_at = now() where id = p_order_id;
    insert into order_events (order_id, status, note) values (p_order_id, 'incident', 'Pago aprobado sobre pedido ' || o.status || ': revisar stock y reembolso');
    return jsonb_build_object('status', 'incident');
  end if;

  if o.shipping_quote_status in ('pending', 'quoted') then
    update orders set status = 'incident', payment_status = 'approved', updated_at = now() where id = p_order_id;
    insert into order_events (order_id, status, note) values (p_order_id, 'incident', 'Pago recibido antes de aceptar la cotización de envío: revisar');
    return jsonb_build_object('status', 'incident');
  end if;

  if p_amount <> o.total then
    update orders set status = 'incident', payment_status = 'approved', updated_at = now() where id = p_order_id;
    insert into order_events (order_id, status, note) values (p_order_id, 'incident', format('Monto pagado %s distinto al total %s', p_amount, o.total));
    return jsonb_build_object('status', 'incident');
  end if;

  for it in select * from order_items where order_id = p_order_id and fulfillment_type = 'own' order by variant_id loop
    update inventory set quantity = quantity - it.quantity, reserved = reserved - it.quantity, updated_at = now()
     where variant_id = it.variant_id and location = it.location;
    insert into inventory_movements (variant_id, location, type, quantity, order_id, note, created_by)
    values (it.variant_id, it.location, 'sale', -it.quantity, p_order_id, 'Venta ' || o.number, auth.uid());
  end loop;

  select exists (select 1 from order_items where order_id = p_order_id and fulfillment_type = 'on_order') into v_has_on_order;
  v_new := case when v_has_on_order then 'awaiting_supplier'::order_status else 'preparing'::order_status end;
  update orders set status = v_new, payment_status = 'approved', payment_method = p_provider, stock_state = 'sold',
                    paid_at = now(), reservation_expires_at = null, updated_at = now()
   where id = p_order_id;
  insert into order_events (order_id, status, note, created_by) values (p_order_id, v_new, 'Pago aprobado (' || p_provider || ')', auth.uid());
  insert into shipments (order_id, status, shipping_cost) values (p_order_id, 'preparing', o.shipping)
  on conflict (order_id) do nothing;
  insert into shipment_events (order_id, status, note) values (p_order_id, 'preparing', 'Pago confirmado: pedido por preparar');
  return jsonb_build_object('status', v_new, 'payment_status', 'approved');
end $$;

-- ---------------------------------------------------------------------------
-- Shipping quotes
-- ---------------------------------------------------------------------------
create or replace function public.set_shipping_quote(p_order_id uuid, p_amount int, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare o orders; s store_settings;
begin
  if not has_role(array['sales']) then raise exception 'FORBIDDEN'; end if;
  if p_amount is null or p_amount < 0 or p_amount > 5000000 then raise exception 'INVALID_AMOUNT'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status <> 'pending_payment' or o.shipping_quote_status not in ('pending', 'quoted') then
    raise exception 'QUOTE_NOT_ALLOWED:%', o.shipping_quote_status;
  end if;
  select * into s from store_settings where id = 1;
  update orders
     set shipping = p_amount, total = subtotal - discount + p_amount,
         shipping_quote_status = 'quoted', shipping_quoted_at = now(),
         reservation_expires_at = greatest(coalesce(reservation_expires_at, now()), now() + make_interval(hours => s.quote_reservation_hours)),
         updated_at = now()
   where id = p_order_id;
  insert into order_events (order_id, status, note, created_by)
  values (p_order_id, o.status, format('Envío cotizado: %s COP%s', p_amount, coalesce(' · ' || p_note, '')), auth.uid());
  insert into shipment_events (order_id, status, note, created_by) values (p_order_id, 'pending_quote', format('Cotización enviada al cliente: %s COP', p_amount), auth.uid());
  return jsonb_build_object('total', o.subtotal - o.discount + p_amount, 'shipping', p_amount);
end $$;

create or replace function public.accept_shipping_quote(p_number text, p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare o orders;
begin
  select * into o from orders where number = upper(trim(p_number)) for update;
  if not found or o.access_token <> coalesce(p_token, '') then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.shipping_quote_status <> 'quoted' then raise exception 'QUOTE_NOT_READY:%', o.shipping_quote_status; end if;
  if o.status <> 'pending_payment' or (o.reservation_expires_at is not null and o.reservation_expires_at < now()) then
    raise exception 'RESERVATION_EXPIRED';
  end if;
  update orders set shipping_quote_status = 'accepted', shipping_accepted_at = now(), updated_at = now() where id = o.id;
  insert into order_events (order_id, status, note) values (o.id, o.status, 'Cliente aceptó la cotización de envío');
  return jsonb_build_object('total', o.total, 'shipping', o.shipping);
end $$;

-- ---------------------------------------------------------------------------
-- Shipments (manual). record_shipment keeps its contract; update_shipment is
-- the general tool for the admin's shipping board.
-- ---------------------------------------------------------------------------
create or replace function public.update_shipment(
  p_order_id uuid, p_status shipment_status, p_carrier text default null, p_tracking text default null,
  p_note text default null, p_occurred_at timestamptz default null, p_estimated date default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare o orders; sh shipments; v_carrier text; v_tracking text; v_at timestamptz := coalesce(p_occurred_at, now());
begin
  if not has_role(array['sales']) then raise exception 'FORBIDDEN'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  select * into sh from shipments where order_id = p_order_id for update;
  v_carrier := coalesce(nullif(trim(p_carrier), ''), sh.carrier);
  v_tracking := coalesce(nullif(trim(p_tracking), ''), sh.tracking_number);

  if p_status in ('dispatched', 'in_transit', 'delivered', 'delivery_issue') then
    if o.paid_at is null then raise exception 'ORDER_NOT_PAID'; end if;
    if o.status not in ('preparing', 'shipped', 'delivered', 'incident') then raise exception 'ORDER_NOT_READY:%', o.status; end if;
    if coalesce(v_carrier, '') = '' or coalesce(v_tracking, '') = '' then raise exception 'CARRIER_AND_TRACKING_REQUIRED'; end if;
  end if;
  if p_status = 'pending_quote' and o.shipping_quote_status not in ('pending', 'quoted') then
    raise exception 'INVALID_TRANSITION:%->pending_quote', coalesce(sh.status::text, 'none');
  end if;

  insert into shipments (order_id, status, carrier, tracking_number, notes, estimated_delivery, shipping_cost, shipped_at, delivered_at)
  values (p_order_id, p_status, v_carrier, v_tracking, p_note, p_estimated, o.shipping,
          case when p_status in ('dispatched', 'in_transit', 'delivered') then v_at end,
          case when p_status = 'delivered' then v_at end)
  on conflict (order_id) do update
     set status = excluded.status,
         carrier = excluded.carrier,
         tracking_number = excluded.tracking_number,
         notes = coalesce(excluded.notes, shipments.notes),
         estimated_delivery = coalesce(excluded.estimated_delivery, shipments.estimated_delivery),
         shipped_at = coalesce(shipments.shipped_at, excluded.shipped_at),
         delivered_at = case when excluded.status = 'delivered' then coalesce(shipments.delivered_at, excluded.delivered_at) else shipments.delivered_at end,
         updated_at = now();
  insert into shipment_events (order_id, status, note, occurred_at, created_by) values (p_order_id, p_status, p_note, v_at, auth.uid());

  -- keep the order lifecycle in step with the delivery
  if p_status in ('dispatched', 'in_transit') and o.status = 'preparing' then
    update orders set status = 'shipped', updated_at = now() where id = p_order_id;
    insert into order_events (order_id, status, note, created_by) values (p_order_id, 'shipped', v_carrier || ' · guía ' || v_tracking, auth.uid());
  elsif p_status = 'delivered' and o.status in ('preparing', 'shipped', 'incident') then
    update orders set status = 'delivered', updated_at = now() where id = p_order_id;
    insert into order_events (order_id, status, note, created_by) values (p_order_id, 'delivered', p_note, auth.uid());
  end if;
  return jsonb_build_object('shipment_status', p_status);
end $$;

create or replace function public.record_shipment(p_order_id uuid, p_carrier text, p_tracking text, p_notes text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare o orders;
begin
  if not has_role(array['sales']) then raise exception 'FORBIDDEN'; end if;
  select * into o from orders where id = p_order_id for update;
  if o.status <> 'preparing' then raise exception 'INVALID_TRANSITION:%->shipped', o.status; end if;
  if coalesce(trim(p_carrier), '') = '' or coalesce(trim(p_tracking), '') = '' then raise exception 'CARRIER_AND_TRACKING_REQUIRED'; end if;
  perform update_shipment(p_order_id, 'dispatched', p_carrier, p_tracking, p_notes, null, null);
end $$;

create or replace function public.set_order_status(p_order_id uuid, p_status order_status, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare o orders; ok boolean;
begin
  if not has_role(array['sales']) then raise exception 'FORBIDDEN'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if p_status = 'cancelled' then
    perform _cancel_order(p_order_id, coalesce(p_note, 'Cancelado por staff'), auth.uid());
    return;
  end if;

  ok := case
    when p_status = 'incident' then o.status not in ('cancelled', 'delivered')
    when o.status = 'shipped' and p_status = 'delivered' then true
    when o.status = 'incident' and p_status in ('preparing', 'shipped', 'delivered') then o.paid_at is not null
    when o.status = 'awaiting_supplier' and p_status = 'preparing' then
      not exists (select 1 from order_items where order_id = o.id and fulfillment_type = 'on_order' and supplier_confirmed_at is null)
    else false
  end;
  if not ok then raise exception 'INVALID_TRANSITION:%->%', o.status, p_status; end if;

  update orders set status = p_status, updated_at = now() where id = p_order_id;
  if p_status = 'delivered' then
    update shipments set delivered_at = coalesce(delivered_at, now()), status = 'delivered', updated_at = now() where order_id = p_order_id;
    if found then insert into shipment_events (order_id, status, note, created_by) values (p_order_id, 'delivered', p_note, auth.uid()); end if;
  end if;
  insert into order_events (order_id, status, note, created_by) values (p_order_id, p_status, p_note, auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Public tracking (number + email) — now with separate statuses
-- ---------------------------------------------------------------------------
create or replace function public.track_order(p_number text, p_email text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'number', o.number, 'status', o.status, 'created_at', o.created_at, 'total', o.total,
    'subtotal', o.subtotal, 'shipping', o.shipping, 'discount', o.discount,
    'payment_method', o.payment_method, 'payment_status', o.payment_status, 'paid_at', o.paid_at,
    'shipping_quote_status', o.shipping_quote_status,
    'items', (select jsonb_agg(jsonb_build_object('name', i.product_name, 'brand', i.brand_name, 'size', i.size,
                'color', i.color, 'quantity', i.quantity, 'fulfillment', i.fulfillment_type, 'lead_time_days', i.lead_time_days))
              from order_items i where i.order_id = o.id),
    'shipment', (select jsonb_build_object('status', s.status, 'carrier', s.carrier, 'tracking_number', s.tracking_number,
                   'shipped_at', s.shipped_at, 'delivered_at', s.delivered_at, 'estimated_delivery', s.estimated_delivery)
                 from shipments s where s.order_id = o.id),
    'shipment_events', (select jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'at', e.occurred_at) order by e.occurred_at)
                        from shipment_events e where e.order_id = o.id),
    'events', (select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.created_at)
               from order_events e where e.order_id = o.id)
  )
  from orders o
  where o.number = upper(trim(p_number)) and o.email = lower(trim(p_email));
$$;

-- ---------------------------------------------------------------------------
-- Dashboard (replaces 0002): adds payments and shipping KPIs
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare r jsonb; v_today date := (now() at time zone 'America/Bogota')::date; v_low int;
begin
  if not is_staff() then raise exception 'FORBIDDEN'; end if;
  select low_stock_threshold into v_low from store_settings where id = 1;
  with paid as (
    select o.* from orders o where o.paid_at is not null and o.status <> 'cancelled'
  ), lines as (
    select i.*, o.paid_at from order_items i join paid o on o.id = i.order_id
  )
  select jsonb_build_object(
    'sales_today', coalesce((select sum(total) from paid where (paid_at at time zone 'America/Bogota')::date = v_today), 0),
    'orders_today', (select count(*) from paid where (paid_at at time zone 'America/Bogota')::date = v_today),
    'sales_month', coalesce((select sum(total) from paid where date_trunc('month', paid_at at time zone 'America/Bogota') = date_trunc('month', v_today::timestamp)), 0),
    'revenue_total', coalesce((select sum(total) from paid), 0),
    'paid_orders', (select count(*) from paid),
    'average_ticket', coalesce((select avg(total)::int from paid), 0),
    'margin_month', coalesce((select sum((unit_price - coalesce(unit_cost, unit_price)) * quantity) from lines
                               where date_trunc('month', paid_at at time zone 'America/Bogota') = date_trunc('month', v_today::timestamp)), 0),
    'lines_without_cost', (select count(*) from lines where unit_cost is null),
    'pending_orders', (select count(*) from orders where status in ('pending_payment', 'awaiting_transfer', 'awaiting_supplier', 'preparing', 'incident')),
    'awaiting_payment', (select count(*) from orders where status in ('pending_payment', 'awaiting_transfer')),
    'awaiting_supplier', (select count(*) from orders where status = 'awaiting_supplier'),
    'incidents', (select count(*) from orders where status = 'incident'),
    'completed_orders', (select count(*) from orders where status = 'delivered'),
    'pending_quotes', (select count(*) from orders where status = 'pending_payment' and shipping_quote_status = 'pending'),
    'to_dispatch', (select count(*) from orders where status = 'preparing'),
    'delivery_issues', (select count(*) from shipments where status = 'delivery_issue'),
    'payments_approved', (select count(*) from payments where status = 'approved'),
    'payments_failed', (select count(*) from payments where status in ('declined', 'error', 'voided')),
    'webhook_errors', (select count(*) from webhook_events where status in ('rejected', 'error') and received_at > now() - interval '7 days'),
    'active_products', (select count(*) from products where is_active),
    'low_stock', (select count(*) from variant_availability where own_available between 1 and v_low),
    'sold_out_variants', (select count(*) from variant_availability where status = 'sold_out'),
    'own_units', coalesce((select sum(quantity) from inventory), 0),
    'own_stock_value', coalesce((select sum(quantity * coalesce(unit_cost, 0)) from inventory), 0),
    'on_order_variants', (select count(*) from variant_availability where status = 'available_on_order'),
    'top_products', coalesce((select jsonb_agg(t) from (
        select product_name as name, brand_name as brand, sum(quantity)::int as units, sum(unit_price * quantity)::int as revenue
        from lines group by 1, 2 order by units desc limit 5) t), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Audit + updated_at on the new tables
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['shipping_rates', 'home_media'] loop
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_row()', t);
  end loop;
end $$;
drop trigger if exists shipping_rates_touch on shipping_rates;
create trigger shipping_rates_touch before update on shipping_rates for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS for new tables and refreshed policies
-- ---------------------------------------------------------------------------
alter table shipping_rates enable row level security;
alter table shipment_events enable row level security;
alter table home_media enable row level security;

drop policy if exists shipping_rates_public_read on shipping_rates;
create policy shipping_rates_public_read on shipping_rates for select using (is_active or is_staff());
drop policy if exists shipping_rates_staff_write on shipping_rates;
create policy shipping_rates_staff_write on shipping_rates for all using (has_role(array['sales'])) with check (has_role(array['sales']));

drop policy if exists shipment_events_read on shipment_events;
create policy shipment_events_read on shipment_events for select
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or has_role(array['sales', 'inventory']))));

drop policy if exists home_media_public_read on home_media;
create policy home_media_public_read on home_media for select using (true);
drop policy if exists home_media_admin_write on home_media;
create policy home_media_admin_write on home_media for all using (has_role(array[]::text[])) with check (has_role(array[]::text[]));

-- sales staff need the payment event log to reconcile payments
drop policy if exists webhooks_admin_read on webhook_events;
create policy webhooks_admin_read on webhook_events for select using (has_role(array['sales']));

revoke insert, update, delete on shipment_events from anon, authenticated;
revoke insert, update, delete on webhook_events from anon, authenticated;
revoke truncate, trigger, references on shipping_rates, shipment_events, home_media from anon, authenticated;
-- the access token is a bearer secret: never readable through column grants by anon
revoke update on orders from authenticated;
grant update (staff_notes) on orders to authenticated;

-- ---------------------------------------------------------------------------
-- Execution grants (functions are PUBLIC-executable by default in Postgres)
-- ---------------------------------------------------------------------------
revoke execute on function public.resolve_shipping(text, text, int),
  public.start_order_payment(text, text, text),
  public.set_shipping_quote(uuid, int, text),
  public.accept_shipping_quote(text, text),
  public.update_shipment(uuid, shipment_status, text, text, text, timestamptz, date)
  from public, anon, authenticated;
grant execute on function public.resolve_shipping(text, text, int), public.start_order_payment(text, text, text),
  public.accept_shipping_quote(text, text) to anon, authenticated;
grant execute on function public.set_shipping_quote(uuid, int, text),
  public.update_shipment(uuid, shipment_status, text, text, text, timestamptz, date) to authenticated;
grant execute on all functions in schema public to service_role;
