-- MORDISCO OS — PERMISOS POR EMPLEADO Y CONTROL DE CAJA
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.staff
add column if not exists permissions jsonb not null default '[]'::jsonb;

update public.staff
set permissions=case role
  when 'waiter' then '["comandas"]'::jsonb
  when 'cashier' then '["pos"]'::jsonb
  when 'kitchen' then '["kitchen"]'::jsonb
  else '[]'::jsonb
end
where permissions='[]'::jsonb or permissions is null;

create table if not exists public.cash_register_state(
  id integer primary key default 1 check(id=1),
  is_open boolean not null default false,
  opened_at timestamptz,
  closed_at timestamptz,
  changed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.cash_register_state(id,is_open)
values(1,false)
on conflict(id) do nothing;

alter table public.cash_register_state enable row level security;

drop policy if exists "Estado de caja visible" on public.cash_register_state;
create policy "Estado de caja visible"
on public.cash_register_state
for select
to anon,authenticated
using(true);

drop policy if exists "Solo administradores cambian caja" on public.cash_register_state;
create policy "Solo administradores cambian caja"
on public.cash_register_state
for all
to authenticated
using(public.is_admin())
with check(public.is_admin());

-- Permitir que administradores actualicen permisos del personal.
drop policy if exists "Administradores actualizan permisos personal" on public.staff;
create policy "Administradores actualizan permisos personal"
on public.staff
for update
to authenticated
using(public.is_admin())
with check(public.is_admin());

select id,name,role,permissions,active
from public.staff
order by name;

select * from public.cash_register_state;
