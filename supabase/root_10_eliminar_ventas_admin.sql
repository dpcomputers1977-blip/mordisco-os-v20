-- MORDISCO OS V9 — OPERACIÓN, MESAS Y COMANDAS
-- Ejecutar completo en Supabase SQL Editor.

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  seats integer not null default 4 check (seats > 0),
  status text not null default 'free' check (status in ('free','occupied','preparing','payment')),
  current_order_id uuid references public.orders(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists table_id uuid references public.restaurant_tables(id) on delete set null;

alter table public.restaurant_tables enable row level security;

drop policy if exists "Admins gestionan mesas" on public.restaurant_tables;
create policy "Admins gestionan mesas"
on public.restaurant_tables
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Permite al personal autenticado mediante funciones SECURITY DEFINER operar mesas.
create or replace function public.employee_update_table(
  employee_id uuid,
  employee_pin text,
  table_id uuid,
  new_status text,
  new_order_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path=public,extensions
as $$
begin
  if not public.verify_staff_pin(employee_id,employee_pin) then
    raise exception 'PIN incorrecto';
  end if;
  if new_status not in ('free','occupied','preparing','payment') then
    raise exception 'Estado inválido';
  end if;
  update public.restaurant_tables
  set status=new_status,
      current_order_id=case when new_status='free' then null else coalesce(new_order_id,current_order_id) end,
      staff_id=case when new_status='free' then null else employee_id end,
      updated_at=now()
  where id=table_id;
  return found;
end;
$$;

grant execute on function public.employee_update_table(uuid,text,uuid,text,uuid) to authenticated, anon;

create index if not exists idx_restaurant_tables_status on public.restaurant_tables(status);
create index if not exists idx_orders_table_id on public.orders(table_id);

insert into public.restaurant_tables(name,seats,sort_order)
select 'Mesa '||n,4,n
from generate_series(1,8) n
on conflict(name) do nothing;
