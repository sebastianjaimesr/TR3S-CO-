-- TR3S & CO. — business logic that must be atomic lives in the database.

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
create or replace function public.has_role(required text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and (role_id = 'admin' or role_id = any(required))
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from user_roles where user_id = auth.uid()); $$;

create or replace function public.is_service()
returns boolean
language sql stable
as $$ select coalesce(auth.role(), '') = 'service_role'; $$;

-- ---------------------------------------------------------------------------
-- Availability: own stock and supplier stock are computed separately.
-- The view runs with the owner's rights so the public storefront can read
-- aggregated availability without access to costs or locations.
-- ---------------------------------------------------------------------------
create or replace view public.variant_availability as
select
  v.id as variant_id,
  coalesce(own.qty, 0)::int as own_available,
  coalesce(sup.quantity_reported, 0)::int as supplier_available,
  sup.lead_time_days,
  sup.confirmed_at as supplier_confirmed_at,
  case
    when coalesce(own.qty, 0) > 0 then 'available_now'
    when coalesce(sup.quantity_reported, 0) > 0 then 'available_on_order'
    else 'sold_out'
  end as status
from product_variants v
left join lateral (
  select sum(i.quantity - i.reserved) as qty
  from inventory i where i.variant_id = v.id
) own on true
left join lateral (
  select ss.quantity_reported, ss.lead_time_days, ss.confirmed_at
  from supplier_stock ss
  join suppliers s on s.id = ss.supplier_id and s.is_active
  cross join store_settings st
  where ss.variant_id = v.id
    and ss.is_available
    and ss.quantity_reported > 0
    and ss.confirmed_at > now() - make_interval(days => st.supplier_confirmation_max_age_days)
  order by ss.lead_time_days, ss.supplier_cost
  limit 1
) sup on true
where v.is_active;

-- ---------------------------------------------------------------------------
-- Internal: release / restore stock of an order
-- ---------------------------------------------------------------------------
create or replace function public._release_order_stock(p_order_id uuid, p_was_sold boolean, p_actor uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare it record;
begin
  for it in select * from order_items where order_id = p_order_id order by variant_id loop
    if it.fulfillment_type = 'own' then
      if p_was_sold then
        update inventory set quantity = quantity + it.quantity, updated_at = now()
          where variant_id = it.variant_id and location = it.location;
        insert into inventory_movements (variant_id, location, type, quantity, order_id, note, created_by)
          values (it.variant_id, it.location, 'return', it.quantity, p_order_id, 'Pedido cancelado: reingreso', p_actor);
      else
        update inventory set reserved = reserved - it.quantity, updated_at = now()
          where variant_id = it.variant_id and location = it.location;
        insert into inventory_movements (variant_id, location, type, quantity, order_id, note, created_by)
          values (it.variant_id, it.location, 'release', it.quantity, p_order_id, 'Reserva liberada', p_actor);
      end if;
    elsif it.supplier_stock_id is not null then
      update supplier_stock set quantity_reported = quantity_reported + it.quantity, updated_at = now()
        where id = it.supplier_stock_id;
    end if;
  end loop;
end $$;

create or replace function public._cancel_order(p_order_id uuid, p_reason text, p_actor uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare o orders;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('cancelled', 'shipped', 'delivered') then
    raise exception 'ORDER_NOT_CANCELLABLE:%', o.status;
  end if;
  if o.stock_state <> 'released' then
    perform _release_order_stock(p_order_id, o.stock_state = 'sold', p_actor);
  end if;
  update orders set status = 'cancelled', stock_state = 'released', cancelled_at = now(), updated_at = now() where id = p_order_id;
  insert into order_events (order_id, status, note, created_by) values (p_order_id, 'cancelled', p_reason, p_actor);
end $$;

-- Cancels orders whose reservation expired (unpaid). Safe to call often.
create or replace function public.expire_reservations()
returns int
language plpgsql security definer set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in
    select id from orders
    where status in ('pending_payment', 'awaiting_transfer')
      and reservation_expires_at < now()
    order by created_at
    for update skip locked
  loop
    perform _cancel_order(r.id, 'Reserva expirada sin pago', null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- create_order: validates prices and stock server-side, reserves stock
-- atomically and is idempotent per idempotency_key.
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
  v_discount int := 0;
  v_coupon coupons;
  v_item record;
  v_row record;
  v_inv inventory;
  v_sup supplier_stock;
  v_price int;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
begin
  if v_key is null or length(v_key) < 16 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;

  select * into v_existing from orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'number', v_existing.number,
      'total', v_existing.total, 'status', v_existing.status, 'duplicate', true);
  end if;

  perform expire_reservations();

  select * into v_settings from store_settings where id = 1;
  if v_method = 'wompi' and not v_settings.payment_wompi_enabled then raise exception 'PAYMENT_METHOD_DISABLED'; end if;
  if v_method = 'transfer' and not v_settings.payment_transfer_enabled then raise exception 'PAYMENT_METHOD_DISABLED'; end if;
  if v_method not in ('wompi', 'transfer') then raise exception 'PAYMENT_METHOD_DISABLED'; end if;

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

    -- 1) own inventory first, single location with enough free units
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
      -- 2) supplier stock, only with a fresh confirmation
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

  -- Coupon
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

  v_shipping := case when v_settings.free_shipping_from is not null and v_subtotal - v_discount >= v_settings.free_shipping_from
                     then 0 else v_settings.shipping_flat_rate end;

  -- Customer (snapshot also kept on the order). Do not overwrite a customer
  -- record that belongs to another signed-in account.
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

  insert into orders (id, number, customer_id, user_id, email, phone, first_name, last_name, department, city,
                      address, address_notes, status, payment_method, subtotal, shipping, discount, total,
                      coupon_code, idempotency_key, reservation_expires_at)
  values (v_order_id, v_number, v_customer_id, auth.uid(), lower(v_c->>'email'), v_c->>'phone',
          v_c->>'first_name', v_c->>'last_name', v_c->>'department', v_c->>'city', v_c->>'address',
          nullif(v_c->>'address_notes', ''),
          case when v_method = 'transfer' then 'awaiting_transfer'::order_status else 'pending_payment'::order_status end,
          v_method, v_subtotal, v_shipping, v_discount, v_subtotal - v_discount + v_shipping,
          case when v_discount > 0 then upper(p->>'coupon_code') end, v_key,
          now() + case when v_method = 'transfer' then interval '48 hours' else interval '60 minutes' end);

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
      -- Commit supplier units to this order so they cannot be sold twice.
      update supplier_stock set quantity_reported = quantity_reported - (v_line->>'quantity')::int, updated_at = now()
       where id = (v_line->>'supplier_stock_id')::uuid;
    end if;
  end loop;

  insert into order_events (order_id, status, note)
  values (v_order_id, case when v_method = 'transfer' then 'awaiting_transfer'::order_status else 'pending_payment'::order_status end, 'Pedido creado');

  return jsonb_build_object('order_id', v_order_id, 'number', v_number,
    'total', v_subtotal - v_discount + v_shipping, 'subtotal', v_subtotal, 'shipping', v_shipping,
    'discount', v_discount, 'duplicate', false);
end $$;

-- ---------------------------------------------------------------------------
-- confirm_payment: called by the Wompi webhook (service role) or by staff
-- (sales/admin) for bank transfers. Idempotent per (provider, transaction_id).
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_order_id uuid, p_provider text, p_transaction_id text, p_amount int, p_status payment_status, p_raw jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare o orders; it record; v_has_on_order boolean; v_new order_status;
begin
  if not (is_service() or has_role(array['sales'])) then raise exception 'FORBIDDEN'; end if;

  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  insert into payments (order_id, provider, transaction_id, status, amount, raw, verified_by)
  values (p_order_id, p_provider, p_transaction_id, p_status, p_amount, p_raw, auth.uid())
  on conflict (provider, transaction_id) do update set status = excluded.status, raw = excluded.raw;

  if p_status <> 'approved' then
    insert into order_events (order_id, status, note, created_by)
    values (p_order_id, o.status, 'Pago ' || p_status || ' (' || p_provider || ')', auth.uid());
    return jsonb_build_object('status', o.status);
  end if;

  if o.status not in ('pending_payment', 'awaiting_transfer') then
    if o.paid_at is not null then
      return jsonb_build_object('status', o.status, 'already_paid', true);
    end if;
    -- Paid after expiry/cancellation: needs a human decision.
    update orders set status = 'incident', updated_at = now() where id = p_order_id;
    insert into order_events (order_id, status, note) values (p_order_id, 'incident', 'Pago aprobado sobre pedido ' || o.status || ': revisar stock y reembolso');
    return jsonb_build_object('status', 'incident');
  end if;

  if p_amount <> o.total then
    update orders set status = 'incident', updated_at = now() where id = p_order_id;
    insert into order_events (order_id, status, note) values (p_order_id, 'incident', format('Monto pagado %s distinto al total %s', p_amount, o.total));
    return jsonb_build_object('status', 'incident');
  end if;

  -- Reservation becomes a sale.
  for it in select * from order_items where order_id = p_order_id and fulfillment_type = 'own' order by variant_id loop
    update inventory set quantity = quantity - it.quantity, reserved = reserved - it.quantity, updated_at = now()
     where variant_id = it.variant_id and location = it.location;
    insert into inventory_movements (variant_id, location, type, quantity, order_id, note, created_by)
    values (it.variant_id, it.location, 'sale', -it.quantity, p_order_id, 'Venta ' || o.number, auth.uid());
  end loop;

  select exists (select 1 from order_items where order_id = p_order_id and fulfillment_type = 'on_order') into v_has_on_order;
  v_new := case when v_has_on_order then 'awaiting_supplier'::order_status else 'preparing'::order_status end;
  update orders set status = v_new, stock_state = 'sold', paid_at = now(), reservation_expires_at = null, updated_at = now() where id = p_order_id;
  insert into order_events (order_id, status, note, created_by) values (p_order_id, v_new, 'Pago aprobado (' || p_provider || ')', auth.uid());
  return jsonb_build_object('status', v_new);
end $$;

-- ---------------------------------------------------------------------------
-- Supplier confirmation for an on-order line (history kept).
-- ---------------------------------------------------------------------------
create or replace function public.confirm_supplier_item(p_order_item_id uuid, p_available boolean, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare it order_items; o orders; v_pending int;
begin
  if not has_role(array['sales', 'inventory']) then raise exception 'FORBIDDEN'; end if;
  select * into it from order_items where id = p_order_item_id for update;
  if not found or it.fulfillment_type <> 'on_order' then raise exception 'NOT_ON_ORDER_ITEM'; end if;
  select * into o from orders where id = it.order_id for update;

  insert into supplier_confirmations (supplier_stock_id, order_item_id, quantity_reported, is_available, notes, confirmed_by)
  values (it.supplier_stock_id, it.id, case when p_available then it.quantity else 0 end, p_available, p_notes, auth.uid());

  if not p_available then
    update supplier_stock set is_available = false, confirmed_at = now(), updated_at = now() where id = it.supplier_stock_id;
    update orders set status = 'incident', updated_at = now() where id = o.id;
    insert into order_events (order_id, status, note, created_by) values (o.id, 'incident', 'Proveedor sin disponibilidad para ' || it.sku, auth.uid());
    return jsonb_build_object('status', 'incident');
  end if;

  update order_items set supplier_confirmed_at = now() where id = it.id;
  select count(*) into v_pending from order_items where order_id = o.id and fulfillment_type = 'on_order' and supplier_confirmed_at is null;
  if v_pending = 0 and o.status = 'awaiting_supplier' then
    update orders set status = 'preparing', updated_at = now() where id = o.id;
    insert into order_events (order_id, status, note, created_by) values (o.id, 'preparing', 'Proveedor confirmó todos los ítems', auth.uid());
    return jsonb_build_object('status', 'preparing');
  end if;
  return jsonb_build_object('status', o.status, 'pending_supplier_items', v_pending);
end $$;

-- ---------------------------------------------------------------------------
-- Order status transitions (staff)
-- ---------------------------------------------------------------------------
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
  insert into shipments (order_id, carrier, tracking_number, notes) values (p_order_id, p_carrier, p_tracking, p_notes)
  on conflict (order_id) do update set carrier = excluded.carrier, tracking_number = excluded.tracking_number, notes = excluded.notes, shipped_at = now();
  update orders set status = 'shipped', updated_at = now() where id = p_order_id;
  insert into order_events (order_id, status, note, created_by) values (p_order_id, 'shipped', p_carrier || ' · guía ' || p_tracking, auth.uid());
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
  if p_status = 'delivered' then update shipments set delivered_at = now() where order_id = p_order_id; end if;
  insert into order_events (order_id, status, note, created_by) values (p_order_id, p_status, p_note, auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Inventory adjustments (staff). Every change is a movement.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_inventory(
  p_variant_id uuid, p_location text, p_type movement_type, p_quantity int, p_unit_cost int default null, p_note text default null
) returns int
language plpgsql security definer set search_path = public
as $$
declare v_delta int; v_new int;
begin
  if not has_role(array['inventory']) then raise exception 'FORBIDDEN'; end if;
  if p_type not in ('entry', 'exit', 'adjustment') then raise exception 'INVALID_MOVEMENT_TYPE'; end if;
  if p_quantity = 0 then raise exception 'INVALID_QUANTITY'; end if;
  v_delta := case p_type when 'entry' then abs(p_quantity) when 'exit' then -abs(p_quantity) else p_quantity end;

  insert into inventory (variant_id, location, quantity, unit_cost)
  values (p_variant_id, coalesce(nullif(trim(p_location), ''), 'bodega-principal'), 0, p_unit_cost)
  on conflict (variant_id, location) do nothing;

  update inventory
     set quantity = quantity + v_delta,
         unit_cost = coalesce(p_unit_cost, unit_cost),
         entered_at = case when v_delta > 0 then now() else entered_at end,
         updated_at = now()
   where variant_id = p_variant_id and location = coalesce(nullif(trim(p_location), ''), 'bodega-principal')
  returning quantity into v_new;
  -- check constraints (quantity >= 0, reserved <= quantity) reject invalid results

  insert into inventory_movements (variant_id, location, type, quantity, unit_cost, note, created_by)
  values (p_variant_id, coalesce(nullif(trim(p_location), ''), 'bodega-principal'), p_type, v_delta, p_unit_cost, p_note, auth.uid());
  return v_new;
end $$;

create or replace function public.confirm_supplier_stock(
  p_supplier_stock_id uuid, p_quantity int, p_available boolean, p_lead_time_days int default null,
  p_supplier_cost int default null, p_notes text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not has_role(array['inventory', 'sales']) then raise exception 'FORBIDDEN'; end if;
  update supplier_stock
     set quantity_reported = greatest(p_quantity, 0),
         is_available = p_available and p_quantity > 0,
         lead_time_days = coalesce(p_lead_time_days, lead_time_days),
         supplier_cost = coalesce(p_supplier_cost, supplier_cost),
         confirmed_at = now(), updated_at = now()
   where id = p_supplier_stock_id;
  if not found then raise exception 'SUPPLIER_STOCK_NOT_FOUND'; end if;
  insert into supplier_confirmations (supplier_stock_id, quantity_reported, is_available, notes, confirmed_by)
  values (p_supplier_stock_id, greatest(p_quantity, 0), p_available and p_quantity > 0, p_notes, auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Public order tracking: requires order number AND email.
-- ---------------------------------------------------------------------------
create or replace function public.track_order(p_number text, p_email text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'number', o.number, 'status', o.status, 'created_at', o.created_at, 'total', o.total,
    'payment_method', o.payment_method,
    'items', (select jsonb_agg(jsonb_build_object('name', i.product_name, 'brand', i.brand_name, 'size', i.size,
                'color', i.color, 'quantity', i.quantity, 'fulfillment', i.fulfillment_type, 'lead_time_days', i.lead_time_days))
              from order_items i where i.order_id = o.id),
    'shipment', (select jsonb_build_object('carrier', s.carrier, 'tracking_number', s.tracking_number,
                   'shipped_at', s.shipped_at, 'delivered_at', s.delivered_at) from shipments s where s.order_id = o.id),
    'events', (select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.created_at)
               from order_events e where e.order_id = o.id)
  )
  from orders o
  where o.number = upper(trim(p_number)) and o.email = lower(trim(p_email));
$$;

-- ---------------------------------------------------------------------------
-- Admin dashboard metrics (Bogotá time)
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
    'margin_month', coalesce((select sum((unit_price - coalesce(unit_cost, unit_price)) * quantity) from lines
                               where date_trunc('month', paid_at at time zone 'America/Bogota') = date_trunc('month', v_today::timestamp)), 0),
    'lines_without_cost', (select count(*) from lines where unit_cost is null),
    'pending_orders', (select count(*) from orders where status in ('pending_payment', 'awaiting_transfer', 'awaiting_supplier', 'preparing', 'incident')),
    'awaiting_supplier', (select count(*) from orders where status = 'awaiting_supplier'),
    'incidents', (select count(*) from orders where status = 'incident'),
    'completed_orders', (select count(*) from orders where status = 'delivered'),
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
-- Audit trigger for sensitive tables
-- ---------------------------------------------------------------------------
create or replace function public.audit_row()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', ''),
          case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
               when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['products', 'product_variants', 'suppliers', 'supplier_stock', 'payments',
                           'user_roles', 'store_settings', 'coupons', 'promotions', 'homepage_campaigns', 'brands', 'shipments']
  loop
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_row()', t);
  end loop;
end $$;

-- Order status changes are audited via order_events; also log to audit for staff actions
create or replace function public.audit_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into audit_logs (actor_id, action, entity, entity_id, data)
    values (auth.uid(), 'STATUS', 'orders', new.id::text, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
drop trigger if exists audit_orders_status on orders;
create trigger audit_orders_status after update on orders for each row execute function audit_order_status();

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists products_touch on products;
create trigger products_touch before update on products for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Execution grants: nothing is callable by default.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.has_role(text[]), public.is_staff(), public.is_service() to anon, authenticated;
grant execute on function public.create_order(jsonb), public.track_order(text, text) to anon, authenticated;
grant execute on function public.confirm_payment(uuid, text, text, int, payment_status, jsonb),
  public.confirm_supplier_item(uuid, boolean, text), public.record_shipment(uuid, text, text, text),
  public.set_order_status(uuid, order_status, text), public.adjust_inventory(uuid, text, movement_type, int, int, text),
  public.confirm_supplier_stock(uuid, int, boolean, int, int, text), public.admin_dashboard_stats(),
  public.expire_reservations()
  to authenticated;
grant execute on all functions in schema public to service_role;
grant select on public.variant_availability to anon, authenticated;
