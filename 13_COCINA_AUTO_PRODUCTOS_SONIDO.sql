-- MORDISCO — COCINA: PEDIDOS AUTOMÁTICOS CON PRODUCTOS
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor.
-- Solo expone pedidos activos y sus productos a la pantalla de Cocina.

create or replace function public.kitchen_get_active_orders()
returns jsonb
language sql
security definer
set search_path=public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',o.id,
        'order_number',o.order_number,
        'status',o.status,
        'customer_name',coalesce(o.customer_name,'Consumidor final'),
        'customer_phone',o.customer_phone,
        'order_type',o.order_type,
        'notes',o.notes,
        'created_at',o.created_at,
        'updated_at',o.updated_at,
        'total',o.total,
        'payment_status',o.payment_status,
        'table_id',o.table_id,
        'order_items',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id',oi.id,
              'quantity',oi.quantity,
              'product_name',coalesce(oi.product_name,'Producto'),
              'notes',oi.notes
            )
            order by oi.created_at,oi.id
          )
          from public.order_items oi
          where oi.order_id=o.id
        ),'[]'::jsonb)
      )
      order by o.created_at asc
    ),
    '[]'::jsonb
  )
  from public.orders o
  where o.status in ('pending','confirmed','preparing','ready');
$$;

revoke all on function public.kitchen_get_active_orders() from public;
grant execute on function public.kitchen_get_active_orders() to anon,authenticated;

-- Verificación: debe devolver pedidos con order_items.
select public.kitchen_get_active_orders();
