-- MORDISCO OS V13.8 — CORRECCIÓN DE INGRESO DE EMPLEADOS
-- Ejecutar completo en Supabase SQL Editor.

-- El portal /staff y /comandas usan la clave pública (rol anon).
-- Se permite únicamente ejecutar la función que compara el PIN cifrado.
grant execute on function public.verify_staff_pin(uuid,text) to anon, authenticated;

-- Garantiza que el portal pueda mostrar solamente empleados activos.
alter table public.staff enable row level security;

drop policy if exists "Portal consulta empleados activos" on public.staff;
create policy "Portal consulta empleados activos"
on public.staff
for select
to anon, authenticated
using (active = true);

-- Mantiene la administración completa reservada al administrador.
drop policy if exists "Admin gestiona personal" on public.staff;
create policy "Admin gestiona personal"
on public.staff
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
