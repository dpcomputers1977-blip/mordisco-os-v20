-- MORDISCO OS V13.9 — LOGIN DE EMPLEADOS FINAL
-- Ejecutar completo en Supabase SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_staff_pin(
  staff_id uuid,
  staff_pin text
)
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select exists(
    select 1
    from public.staff s
    where s.id = staff_id
      and s.active = true
      and s.pin_hash = extensions.crypt(staff_pin, s.pin_hash)
  );
$$;

revoke all on function public.verify_staff_pin(uuid,text) from public;
grant execute on function public.verify_staff_pin(uuid,text) to anon, authenticated;

alter table public.staff enable row level security;

drop policy if exists "Portal consulta empleados activos" on public.staff;
create policy "Portal consulta empleados activos"
on public.staff
for select
to anon, authenticated
using (active = true);

drop policy if exists "Admin gestiona personal" on public.staff;
create policy "Admin gestiona personal"
on public.staff
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
