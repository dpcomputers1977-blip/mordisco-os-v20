-- MORDISCO OS V13.11 — VENTAS SOLO ADMIN + CONTABILIDAD AUTOMÁTICA
-- Ejecutar completo en Supabase SQL Editor.

-- 1) Vincular movimientos contables con ventas.
alter table public.financial_movements
  add column if not exists source text not null default 'manual';

alter table public.financial_movements
  add column if not exists order_id uuid references public.orders(id) on delete cascade;

create unique index if not exists financial_movements_order_unique
on public.financial_movements(order_id)
where order_id is not null;

-- 2) Sincronizar automáticamente cada venta con Contabilidad.
create or replace function public.sync_order_to_accounting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
begin
  if tg_op = 'DELETE' then
    delete from public.financial_movements where order_id = old.id;
    return old;
  end if;

  target_order := new;

  if target_order.status = 'cancelled' then
    delete from public.financial_movements where order_id = target_order.id;
    return new;
  end if;

  insert into public.financial_movements(
    type,
    category,
    description,
    amount,
    payment_method,
    movement_date,
    reference,
    staff_id,
    source,
    order_id,
    created_at,
    updated_at
  )
  values(
    'income',
    'Ventas',
    'Venta #' || coalesce(target_order.order_number::text, left(target_order.id::text,8)),
    target_order.total,
    coalesce(target_order.payment_method,'cash'),
    (target_order.created_at at time zone 'America/Guayaquil')::date,
    'Pedido ' || coalesce(target_order.order_number::text,target_order.id::text),
    target_order.cashier_id,
    'sale',
    target_order.id,
    now(),
    now()
  )
  on conflict (order_id) where order_id is not null
  do update set
    amount = excluded.amount,
    payment_method = excluded.payment_method,
    movement_date = excluded.movement_date,
    reference = excluded.reference,
    staff_id = excluded.staff_id,
    description = excluded.description,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_order_to_accounting on public.orders;
create trigger trg_sync_order_to_accounting
after insert or update of total,status,payment_method,cashier_id
on public.orders
for each row execute function public.sync_order_to_accounting();

-- Importar ventas existentes que no estén canceladas.
insert into public.financial_movements(
  type,category,description,amount,payment_method,movement_date,
  reference,staff_id,source,order_id,created_at,updated_at
)
select
  'income',
  'Ventas',
  'Venta #' || coalesce(o.order_number::text,left(o.id::text,8)),
  o.total,
  coalesce(o.payment_method,'cash'),
  (o.created_at at time zone 'America/Guayaquil')::date,
  'Pedido ' || coalesce(o.order_number::text,o.id::text),
  o.cashier_id,
  'sale',
  o.id,
  now(),
  now()
from public.orders o
where o.status <> 'cancelled'
on conflict (order_id) where order_id is not null
do update set
  amount=excluded.amount,
  payment_method=excluded.payment_method,
  movement_date=excluded.movement_date,
  staff_id=excluded.staff_id,
  updated_at=now();

-- 3) Eliminación segura: exclusivamente administrador autenticado.
create or replace function public.delete_order_admin(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador autorizado puede eliminar ventas';
  end if;

  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;

  if not found then
    raise exception 'La venta no existe';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_order_admin(uuid) from public, anon;
grant execute on function public.delete_order_admin(uuid) to authenticated;

-- Quitar cualquier permiso de eliminación directa anterior.
drop policy if exists "Admin elimina items de pedidos" on public.order_items;
drop policy if exists "Admin elimina pedidos" on public.orders;

-- Solo administradores autenticados pueden eliminar directamente, además del RPC.
create policy "Solo admin elimina items"
on public.order_items
for delete
to authenticated
using (public.is_admin());

create policy "Solo admin elimina ventas"
on public.orders
for delete
to authenticated
using (public.is_admin());
