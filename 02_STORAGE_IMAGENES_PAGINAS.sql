-- MORDISCO OS — STORAGE PARA IMÁGENES DE PÁGINAS
-- Ejecutar una sola vez en Supabase > SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'page-images',
  'page-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Public read page images" on storage.objects;
create policy "Public read page images"
on storage.objects for select
using (bucket_id = 'page-images');

drop policy if exists "Admins upload page images" on storage.objects;
create policy "Admins upload page images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'page-images'
  and exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.active = true
  )
);

drop policy if exists "Admins update page images" on storage.objects;
create policy "Admins update page images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'page-images'
  and exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.active = true
  )
)
with check (
  bucket_id = 'page-images'
  and exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.active = true
  )
);

drop policy if exists "Admins delete page images" on storage.objects;
create policy "Admins delete page images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'page-images'
  and exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.active = true
  )
);
