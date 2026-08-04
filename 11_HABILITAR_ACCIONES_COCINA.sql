-- MORDISCO — ACCIONES FUNCIONALES DE COCINA
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor.
-- Permite únicamente cambios válidos del flujo de Cocina.

create or replace function public.kitchen_update_order_status(
  p_order_id uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  current_status text;
begin
  if p_new_status not in ('preparing','ready','delivered','cancelled') then
    raise exception 'Estado no permitido';
  end if;

  select status
  into current_status
  from public.orders
  where id=p_order_id
  for update;

  if current_status is null then
    raise exception 'Pedido no encontrado';
  end if;

  if not (
    (current_status in ('pending','confirmed') and p_new_status in ('preparing','cancelled'))
    or (current_status='preparing' and p_new_status in ('ready','cancelled'))
    or (current_status='ready' and p_new_status='delivered')
    or current_status=p_new_status
  ) then
    raise exception 'Cambio de estado no válido: % → %', current_status, p_new_status;
  end if;

  update public.orders
  set status=p_new_status,
      updated_at=now()
  where id=p_order_id;
end;
$$;

revoke all on function public.kitchen_update_order_status(uuid,text) from public;
grant execute on function public.kitchen_update_order_status(uuid,text) to anon, authenticated;

-- Verificación de pedidos visibles en Cocina.
select id,order_number,status,customer_name,updated_at
from public.orders
where status in ('pending','confirmed','preparing','ready')
order by created_at desc
limit 20;
