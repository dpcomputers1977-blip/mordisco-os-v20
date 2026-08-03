-- MORDISCO OS V7 — PERSONAL
-- Ejecuta todo en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('waiter','cashier','kitchen')),
  phone text,
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff enable row level security;

drop policy if exists "Admins gestionan personal" on public.staff;
create policy "Admins gestionan personal" on public.staff
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.orders add column if not exists cashier_id uuid references public.staff(id) on delete set null;
alter table public.orders add column if not exists waiter_id uuid references public.staff(id) on delete set null;

create or replace function public.save_staff_member(
  staff_id uuid,
  staff_name text,
  staff_role text,
  staff_phone text,
  staff_pin text,
  staff_active boolean
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  result_id uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  if trim(coalesce(staff_name,''))='' then
    raise exception 'El nombre es obligatorio';
  end if;
  if staff_role not in ('waiter','cashier','kitchen') then
    raise exception 'Rol inválido';
  end if;
  if staff_id is null then
    if staff_pin is null or staff_pin !~ '^[0-9]{4,6}$' then
      raise exception 'El PIN debe tener entre 4 y 6 números';
    end if;
    insert into public.staff(name,role,phone,pin_hash,active)
    values(trim(staff_name),staff_role,nullif(trim(coalesce(staff_phone,'')),''),crypt(staff_pin,gen_salt('bf')),coalesce(staff_active,true))
    returning id into result_id;
  else
    update public.staff
    set name=trim(staff_name),
        role=staff_role,
        phone=nullif(trim(coalesce(staff_phone,'')),''),
        active=coalesce(staff_active,true),
        pin_hash=case when staff_pin is not null and staff_pin<>'' then crypt(staff_pin,gen_salt('bf')) else pin_hash end,
        updated_at=now()
    where id=staff_id
    returning id into result_id;
    if result_id is null then raise exception 'Empleado no encontrado'; end if;
  end if;
  return result_id;
end;
$$;

grant execute on function public.save_staff_member(uuid,text,text,text,text,boolean) to authenticated;

create or replace function public.verify_staff_pin(staff_id uuid, staff_pin text)
returns boolean
language sql
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.staff
    where id=staff_id and active=true and pin_hash=crypt(staff_pin,pin_hash)
  );
$$;

grant execute on function public.verify_staff_pin(uuid,text) to authenticated;

create index if not exists idx_staff_role_active on public.staff(role,active);
create index if not exists idx_orders_cashier on public.orders(cashier_id);
create index if not exists idx_orders_waiter on public.orders(waiter_id);
