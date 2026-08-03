-- MORDISCO OS V13 — WEB PÚBLICA ESTABLE
-- Ejecutar completo en Supabase SQL Editor después de las migraciones anteriores.

alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.business_settings enable row level security;
alter table public.promotions enable row level security;
alter table public.content_pages enable row level security;

drop policy if exists "Catalogo publico productos activos" on public.products;
create policy "Catalogo publico productos activos" on public.products
for select to anon, authenticated using (active = true or public.is_admin());

drop policy if exists "Catalogo publico categorias activas" on public.categories;
create policy "Catalogo publico categorias activas" on public.categories
for select to anon, authenticated using (active = true or public.is_admin());

drop policy if exists "Configuracion publica negocio" on public.business_settings;
create policy "Configuracion publica negocio" on public.business_settings
for select to anon, authenticated using (true);

-- Reemplaza políticas anteriores para evitar que una condición con is_admin()
-- impida la lectura anónima cuando no existe una sesión administrativa.
drop policy if exists "Promociones publicas" on public.promotions;
drop policy if exists "Promociones públicas" on public.promotions;
drop policy if exists "Promociones publicas activas" on public.promotions;
create policy "Promociones publicas activas" on public.promotions
for select to anon, authenticated using (active = true);

drop policy if exists "Paginas publicas" on public.content_pages;
drop policy if exists "Páginas públicas" on public.content_pages;
drop policy if exists "Paginas publicadas" on public.content_pages;
create policy "Paginas publicadas" on public.content_pages
for select to anon, authenticated using (published = true);

-- Mantener escritura exclusivamente administrativa.
drop policy if exists "Admin productos V13" on public.products;
create policy "Admin productos V13" on public.products for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin categorias V13" on public.categories;
create policy "Admin categorias V13" on public.categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());
