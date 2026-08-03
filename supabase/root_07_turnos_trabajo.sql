-- MORDISCO NUBE — PASO 2: STORAGE Y ADMINISTRADOR
-- Ejecuta este archivo completo en SQL Editor después de crear tu usuario en Authentication.

-- 1) Crear bucket público para imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true;

-- 2) Lectura pública de imágenes
drop policy if exists "Imagenes publicas Mordisco" on storage.objects;
create policy "Imagenes publicas Mordisco" on storage.objects for select to public using (bucket_id='product-images');

-- 3) Solo administradores suben, cambian y eliminan imágenes
drop policy if exists "Admins suben imagenes Mordisco" on storage.objects;
create policy "Admins suben imagenes Mordisco" on storage.objects for insert to authenticated with check (bucket_id='product-images' and public.is_admin());
drop policy if exists "Admins actualizan imagenes Mordisco" on storage.objects;
create policy "Admins actualizan imagenes Mordisco" on storage.objects for update to authenticated using (bucket_id='product-images' and public.is_admin()) with check (bucket_id='product-images' and public.is_admin());
drop policy if exists "Admins eliminan imagenes Mordisco" on storage.objects;
create policy "Admins eliminan imagenes Mordisco" on storage.objects for delete to authenticated using (bucket_id='product-images' and public.is_admin());

-- 4) CONVERTIR TU USUARIO EN ADMINISTRADOR
-- Primero crea el usuario en Authentication > Users > Add user.
-- Después reemplaza el correo de abajo y ejecuta este bloque.
insert into public.admin_users (user_id, full_name, active)
select id, 'Administrador Mordisco', true
from auth.users
where email = 'CAMBIA_AQUI_TU_CORREO@gmail.com'
on conflict (user_id) do update set active=true;
