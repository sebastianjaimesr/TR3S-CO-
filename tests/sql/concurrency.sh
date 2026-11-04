#!/usr/bin/env bash
# 15 buyers race for the last unit: exactly one order may succeed.
set -uo pipefail
DB=${TEST_DB:-tr3s_test}
psql -q -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
insert into products (id, slug, name, reference, brand_id, category_id, price, is_active)
values ('40000000-0000-0000-0000-0000000000ff', 'last-unit', 'Last Unit', 'REF-LAST', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 250000, true);
insert into product_variants (id, product_id, sku, size, color)
values ('50000000-0000-0000-0000-0000000000ff', '40000000-0000-0000-0000-0000000000ff', 'LAST-40', '40', 'Negro');
insert into inventory (variant_id, quantity) values ('50000000-0000-0000-0000-0000000000ff', 1);
SQL
for i in $(seq -w 1 15); do
  psql -q -d "$DB" -c "set role anon; select create_order('{\"idempotency_key\":\"race-key-0000000$i\",\"payment_method\":\"wompi\",\"customer\":{\"email\":\"race$i@test.co\",\"first_name\":\"R\",\"last_name\":\"C\",\"phone\":\"3000000000\",\"department\":\"Santander\",\"city\":\"Bucaramanga\",\"address\":\"Calle\"},\"items\":[{\"variant_id\":\"50000000-0000-0000-0000-0000000000ff\",\"quantity\":1}]}')" >/dev/null 2>&1 &
done
wait
N=$(psql -tA -d "$DB" -c "select count(*) from order_items where sku = 'LAST-40'")
R=$(psql -tA -d "$DB" -c "select reserved from inventory where variant_id = '50000000-0000-0000-0000-0000000000ff'")
echo "orders for last unit: $N, reserved: $R"
[ "$N" = "1" ] && [ "$R" = "1" ] || { echo "CONCURRENCY TEST FAILED"; exit 1; }
