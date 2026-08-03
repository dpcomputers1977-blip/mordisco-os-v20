-- MORDISCO OS V10 — IDENTIFICACIÓN DE CAJERO
-- Ejecutar completo en Supabase SQL Editor.

alter table public.orders
  add column if not exists cashier_id uuid references public.staff(id) on delete set null;

alter table public.orders
  add column if not exists waiter_id uuid references public.staff(id) on delete set null;

create index if not exists idx_orders_cashier_id on public.orders(cashier_id);
create index if not exists idx_orders_waiter_id on public.orders(waiter_id);

-- Vista administrativa para reportes de ventas por empleado.
create or replace view public.order_staff_summary
with (security_invoker=true)
as
select
  o.id,
  o.order_number,
  o.created_at,
  o.total,
  o.status,
  o.payment_method,
  o.cashier_id,
  c.name as cashier_name,
  o.waiter_id,
  w.name as waiter_name,
  o.table_id,
  t.name as table_name
from public.orders o
left join public.staff c on c.id=o.cashier_id
left join public.staff w on w.id=o.waiter_id
left join public.restaurant_tables t on t.id=o.table_id;
