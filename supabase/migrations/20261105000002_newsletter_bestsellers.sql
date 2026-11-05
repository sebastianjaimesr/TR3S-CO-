-- TR3S & CO. — Delivery A: newsletter subscribers and public best-seller ranking.
-- Additive only: no existing table or function is changed.

-- ─── Newsletter ─────────────────────────────────────────────────────────────
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 120),
  source text not null default 'home',
  consent_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email)
);
alter table newsletter_subscribers enable row level security;

-- Staff can read and manage the list; nobody else can read it.
drop policy if exists newsletter_staff_all on newsletter_subscribers;
create policy newsletter_staff_all on newsletter_subscribers
  for all to authenticated
  using (public.has_role(array['admin', 'sales']))
  with check (public.has_role(array['admin', 'sales']));
revoke select, insert, update, delete, truncate, trigger, references on newsletter_subscribers from anon;
revoke truncate, trigger, references on newsletter_subscribers from authenticated;

-- Public sign-up goes through this function only (no direct table access).
-- It never reveals whether an address was already subscribed.
create or replace function public.subscribe_newsletter(p_email text, p_source text default 'home')
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or length(v_email) > 120 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  insert into newsletter_subscribers (email, source)
  values (v_email, left(coalesce(nullif(trim(p_source), ''), 'home'), 40))
  on conflict (email) do update
    set unsubscribed_at = null,
        consent_at = case when newsletter_subscribers.unsubscribed_at is not null then now() else newsletter_subscribers.consent_at end;
  return true;
end;
$$;

-- ─── Best sellers ───────────────────────────────────────────────────────────
-- Units sold per active product from orders with an approved payment.
-- Exposes only product ids and unit counts (no customer or order data).
create or replace function public.best_selling_products(p_limit int default 8, p_days int default 90)
returns table (product_id uuid, units bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.product_id, sum(oi.quantity)::bigint as units
  from order_items oi
  join orders o on o.id = oi.order_id
  join product_variants v on v.id = oi.variant_id
  join products p on p.id = v.product_id
  where o.payment_status = 'approved'
    and o.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
    and p.is_active
  group by v.product_id
  order by units desc, v.product_id
  limit greatest(1, least(coalesce(p_limit, 8), 24));
$$;

revoke execute on function public.subscribe_newsletter(text, text), public.best_selling_products(int, int) from public, anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text), public.best_selling_products(int, int) to anon, authenticated, service_role;
