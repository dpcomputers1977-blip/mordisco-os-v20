-- MORDISCO OS V15.3 — PRODUCTOS E IMÁGENES
-- Ejecutar completo en Supabase SQL Editor.

insert into storage.buckets(
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values(
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict(id) do update set
  public=true,
  file_size_limit=5242880,
  allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "Public lee imagenes productos" on storage.objects;
create policy "Public lee imagenes productos"
on storage.objects
for select
to public
using(bucket_id='product-images');

drop policy if exists "Admin sube imagenes productos" on storage.objects;
create policy "Admin sube imagenes productos"
on storage.objects
for insert
to authenticated
with check(bucket_id='product-images' and public.is_admin());

drop policy if exists "Admin actualiza imagenes productos" on storage.objects;
create policy "Admin actualiza imagenes productos"
on storage.objects
for update
to authenticated
using(bucket_id='product-images' and public.is_admin())
with check(bucket_id='product-images' and public.is_admin());

drop policy if exists "Admin elimina imagenes productos" on storage.objects;
create policy "Admin elimina imagenes productos"
on storage.objects
for delete
to authenticated
using(bucket_id='product-images' and public.is_admin());

alter table public.products enable row level security;

drop policy if exists "Public consulta productos visibles" on public.products;
create policy "Public consulta productos visibles"
on public.products
for select
to anon,authenticated
using(active=true or public.is_admin());

drop policy if exists "Admin crea productos" on public.products;
create policy "Admin crea productos"
on public.products
for insert
to authenticated
with check(public.is_admin());

drop policy if exists "Admin edita productos" on public.products;
create policy "Admin edita productos"
on public.products
for update
to authenticated
using(public.is_admin())
with check(public.is_admin());

drop policy if exists "Admin elimina productos" on public.products;
create policy "Admin elimina productos"
on public.products
for delete
to authenticated
using(public.is_admin());
