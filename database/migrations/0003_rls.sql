-- TR3S & CO. — Row Level Security
-- Principle: the storefront reads only published catalog data; everything
-- with costs, stock locations, suppliers, customers or payments is staff-only.
-- Writes that touch stock or orders go exclusively through SECURITY DEFINER
-- functions in 0002_functions.sql.

do $$
declare t text;
begin
  foreach t in array array['roles', 'user_roles', 'customers', 'brands', 'categories', 'suppliers', 'products',
    'product_images', 'product_variants', 'inventory', 'supplier_stock', 'supplier_confirmations',
    'inventory_movements', 'store_settings', 'homepage_campaigns', 'coupons', 'promotions', 'orders',
    'order_items', 'payments', 'webhook_events', 'shipments', 'order_events', 'wishlists', 'wishlist_items', 'audit_logs']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Helper to (re)create a policy idempotently
create or replace function pg_temp.pol(p_table text, p_name text, p_sql text) returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on %I', p_name, p_table);
  execute p_sql;
end $$;

-- Public catalog --------------------------------------------------------------
select pg_temp.pol('brands', 'brands_public_read', $p$create policy brands_public_read on brands for select using (is_active or is_staff())$p$);
select pg_temp.pol('brands', 'brands_admin_write', $p$create policy brands_admin_write on brands for all using (has_role(array['inventory'])) with check (has_role(array['inventory']))$p$);

select pg_temp.pol('categories', 'categories_public_read', $p$create policy categories_public_read on categories for select using (true)$p$);
select pg_temp.pol('categories', 'categories_admin_write', $p$create policy categories_admin_write on categories for all using (has_role(array[]::text[])) with check (has_role(array[]::text[]))$p$);

select pg_temp.pol('products', 'products_public_read', $p$create policy products_public_read on products for select using (is_active or is_staff())$p$);
select pg_temp.pol('products', 'products_staff_write', $p$create policy products_staff_write on products for all using (has_role(array['inventory'])) with check (has_role(array['inventory']))$p$);

select pg_temp.pol('product_images', 'images_public_read', $p$create policy images_public_read on product_images for select using (exists (select 1 from products p where p.id = product_id and (p.is_active or is_staff())))$p$);
select pg_temp.pol('product_images', 'images_staff_write', $p$create policy images_staff_write on product_images for all using (has_role(array['inventory'])) with check (has_role(array['inventory']))$p$);

select pg_temp.pol('product_variants', 'variants_public_read', $p$create policy variants_public_read on product_variants for select using (exists (select 1 from products p where p.id = product_id and (p.is_active or is_staff())))$p$);
select pg_temp.pol('product_variants', 'variants_staff_write', $p$create policy variants_staff_write on product_variants for all using (has_role(array['inventory'])) with check (has_role(array['inventory']))$p$);

select pg_temp.pol('store_settings', 'settings_public_read', $p$create policy settings_public_read on store_settings for select using (true)$p$);
select pg_temp.pol('store_settings', 'settings_admin_write', $p$create policy settings_admin_write on store_settings for update using (has_role(array[]::text[])) with check (has_role(array[]::text[]))$p$);

select pg_temp.pol('homepage_campaigns', 'campaigns_public_read', $p$create policy campaigns_public_read on homepage_campaigns for select using (is_active or is_staff())$p$);
select pg_temp.pol('homepage_campaigns', 'campaigns_admin_write', $p$create policy campaigns_admin_write on homepage_campaigns for all using (has_role(array[]::text[])) with check (has_role(array[]::text[]))$p$);

select pg_temp.pol('promotions', 'promotions_public_read', $p$create policy promotions_public_read on promotions for select using (is_active or is_staff())$p$);
select pg_temp.pol('promotions', 'promotions_admin_write', $p$create policy promotions_admin_write on promotions for all using (has_role(array[]::text[])) with check (has_role(array[]::text[]))$p$);

-- Staff only -----------------------------------------------------------------
select pg_temp.pol('roles', 'roles_staff_read', $p$create policy roles_staff_read on roles for select using (is_staff())$p$);
select pg_temp.pol('user_roles', 'user_roles_read', $p$create policy user_roles_read on user_roles for select using (user_id = auth.uid() or has_role(array[]::text[]))$p$);
select pg_temp.pol('user_roles', 'user_roles_admin_write', $p$create policy user_roles_admin_write on user_roles for all using (has_role(array[]::text[])) with check (has_role(array[]::text[]))$p$);

select pg_temp.pol('suppliers', 'suppliers_staff', $p$create policy suppliers_staff on suppliers for all using (has_role(array['inventory', 'sales'])) with check (has_role(array['inventory']))$p$);
select pg_temp.pol('supplier_stock', 'supplier_stock_staff', $p$create policy supplier_stock_staff on supplier_stock for all using (has_role(array['inventory', 'sales'])) with check (has_role(array['inventory']))$p$);
select pg_temp.pol('supplier_confirmations', 'supplier_conf_staff', $p$create policy supplier_conf_staff on supplier_confirmations for select using (has_role(array['inventory', 'sales']))$p$);

select pg_temp.pol('inventory', 'inventory_staff_read', $p$create policy inventory_staff_read on inventory for select using (has_role(array['inventory', 'sales']))$p$);
select pg_temp.pol('inventory_movements', 'movements_staff_read', $p$create policy movements_staff_read on inventory_movements for select using (has_role(array['inventory', 'sales']))$p$);

select pg_temp.pol('coupons', 'coupons_admin', $p$create policy coupons_admin on coupons for all using (has_role(array[]::text[])) with check (has_role(array[]::text[]))$p$);

select pg_temp.pol('payments', 'payments_staff_read', $p$create policy payments_staff_read on payments for select using (has_role(array['sales']))$p$);
select pg_temp.pol('webhook_events', 'webhooks_admin_read', $p$create policy webhooks_admin_read on webhook_events for select using (has_role(array[]::text[]))$p$);
select pg_temp.pol('audit_logs', 'audit_admin_read', $p$create policy audit_admin_read on audit_logs for select using (has_role(array[]::text[]))$p$);

-- Customers and orders: own rows or staff -----------------------------------
select pg_temp.pol('customers', 'customers_read', $p$create policy customers_read on customers for select using (user_id = auth.uid() or has_role(array['sales']))$p$);
select pg_temp.pol('customers', 'customers_staff_update', $p$create policy customers_staff_update on customers for update using (has_role(array['sales'])) with check (has_role(array['sales']))$p$);

select pg_temp.pol('orders', 'orders_read', $p$create policy orders_read on orders for select using (user_id = auth.uid() or has_role(array['sales', 'inventory']))$p$);
select pg_temp.pol('orders', 'orders_staff_notes', $p$create policy orders_staff_notes on orders for update using (has_role(array['sales'])) with check (has_role(array['sales']))$p$);
select pg_temp.pol('order_items', 'order_items_read', $p$create policy order_items_read on order_items for select using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or has_role(array['sales', 'inventory']))))$p$);
select pg_temp.pol('order_events', 'order_events_read', $p$create policy order_events_read on order_events for select using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or has_role(array['sales', 'inventory']))))$p$);
select pg_temp.pol('shipments', 'shipments_read', $p$create policy shipments_read on shipments for select using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or has_role(array['sales', 'inventory']))))$p$);

-- Wishlists: owner only ------------------------------------------------------
select pg_temp.pol('wishlists', 'wishlists_owner', $p$create policy wishlists_owner on wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid())$p$);
select pg_temp.pol('wishlist_items', 'wishlist_items_owner', $p$create policy wishlist_items_owner on wishlist_items for all using (exists (select 1 from wishlists w where w.id = wishlist_id and w.user_id = auth.uid())) with check (exists (select 1 from wishlists w where w.id = wishlist_id and w.user_id = auth.uid()))$p$);

-- Staff may only edit order staff_notes directly; status goes through functions.
revoke update on orders from authenticated;
grant update (staff_notes) on orders to authenticated;
revoke insert, delete on orders, order_items, payments, inventory, inventory_movements, supplier_confirmations, shipments, order_events, webhook_events, audit_logs from anon, authenticated;
revoke update on inventory, order_items, payments, inventory_movements, audit_logs from anon, authenticated;
