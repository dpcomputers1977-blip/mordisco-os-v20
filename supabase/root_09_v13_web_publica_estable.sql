-- MORDISCO OS V13.6 — ELIMINAR VENTAS SOLO ADMIN
-- Ejecutar completo en Supabase SQL Editor.

-- Permite eliminar items y pedidos únicamente a usuarios autenticados
-- que estén registrados como administradores.

drop policy if exists "Admin elimina items de pedidos" on public.order_items;
create policy "Admin elimina items de pedidos"
on public.order_items
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admin elimina pedidos" on public.orders;
create policy "Admin elimina pedidos"
on public.orders
for delete
to authenticated
using (public.is_admin());
