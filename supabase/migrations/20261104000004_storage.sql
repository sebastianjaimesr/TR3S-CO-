-- Supabase Storage buckets (only runs on Supabase, where the storage schema exists).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('brands', 'brands', true, 2097152, array['image/png', 'image/svg+xml', 'image/webp']),
  ('campaigns', 'campaigns', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('models', 'models', true, 15728640, array['model/gltf-binary', 'application/octet-stream'])
on conflict (id) do nothing;

drop policy if exists "public read tr3s buckets" on storage.objects;
create policy "public read tr3s buckets" on storage.objects for select
  using (bucket_id in ('products', 'brands', 'campaigns', 'models'));

drop policy if exists "staff upload tr3s buckets" on storage.objects;
create policy "staff upload tr3s buckets" on storage.objects for insert
  with check (bucket_id in ('products', 'brands', 'campaigns', 'models') and public.has_role(array['inventory']));

drop policy if exists "staff update tr3s buckets" on storage.objects;
create policy "staff update tr3s buckets" on storage.objects for update
  using (bucket_id in ('products', 'brands', 'campaigns', 'models') and public.has_role(array['inventory']));

drop policy if exists "staff delete tr3s buckets" on storage.objects;
create policy "staff delete tr3s buckets" on storage.objects for delete
  using (bucket_id in ('products', 'brands', 'campaigns', 'models') and public.has_role(array['inventory']));
