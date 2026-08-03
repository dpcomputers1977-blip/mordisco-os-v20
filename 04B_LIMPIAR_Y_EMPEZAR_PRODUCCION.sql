-- ==========================================================
-- MORDISCO OS 1.0 — LIMPIEZA DEFINITIVA DE PRODUCCIÓN
-- ==========================================================
-- ADVERTENCIA: ESTE ARCHIVO ELIMINA LOS DATOS OPERATIVOS.
--
-- CONSERVA:
-- products, categories, product_recipes, ingredients,
-- staff, admin_users, auth.users, promotions, content_pages,
-- business_settings, business_hours y restaurant_tables.
--
-- ELIMINA / REINICIA:
-- ventas, pedidos, comandas, cocina, cobros, turnos, clientes,
-- movimientos de inventario, contabilidad y cuentas pendientes.
--
-- Ejecutar UNA SOLA VEZ, justo antes de comenzar a vender.

begin;

-- Liberar las mesas antes de eliminar órdenes.
update public.restaurant_tables
set status='free',
    current_order_id=null,
    staff_id=null,
    updated_at=now();

-- Eliminar registros dependientes y operativos.
delete from public.inventory_movements;
delete from public.financial_movements;
delete from public.finance_accounts;
delete from public.order_items;
delete from public.orders;
delete from public.work_shifts;
delete from public.customers;

-- Conservar ingredientes y recetas, pero iniciar existencias en cero.
update public.ingredients
set current_stock=0,
    updated_at=now();

-- Reiniciar secuencias identity conocidas cuando existan.
do $$
declare seq_name text;
begin
  for seq_name in
    select pg_get_serial_sequence('public.inventory_movements','id')
    union all
    select pg_get_serial_sequence('public.product_recipes','id')
  loop
    if seq_name is not null then
      execute format('alter sequence %s restart with 1', seq_name);
    end if;
  end loop;
end $$;

commit;

-- COMPROBACIÓN FINAL
select 'orders' as tabla, count(*) as registros from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'inventory_movements', count(*) from public.inventory_movements
union all select 'financial_movements', count(*) from public.financial_movements
union all select 'finance_accounts', count(*) from public.finance_accounts
union all select 'work_shifts', count(*) from public.work_shifts
union all select 'customers', count(*) from public.customers
union all select 'ingredients_with_stock', count(*) from public.ingredients where current_stock <> 0
order by tabla;
