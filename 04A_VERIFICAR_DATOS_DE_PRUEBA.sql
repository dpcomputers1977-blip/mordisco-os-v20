-- MORDISCO OS 1.0 — VERIFICAR DATOS ANTES DE LIMPIAR
-- Este archivo NO elimina nada.

select 'orders' as tabla, count(*) as registros from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'inventory_movements', count(*) from public.inventory_movements
union all select 'financial_movements', count(*) from public.financial_movements
union all select 'finance_accounts', count(*) from public.finance_accounts
union all select 'work_shifts', count(*) from public.work_shifts
union all select 'customers', count(*) from public.customers
union all select 'ingredients_with_stock', count(*) from public.ingredients where current_stock <> 0
order by tabla;

select
  coalesce(sum(case when payment_status='paid' then total else 0 end),0) as ventas_pagadas,
  count(*) filter (where status in ('pending','preparing','ready')) as pedidos_activos
from public.orders;
