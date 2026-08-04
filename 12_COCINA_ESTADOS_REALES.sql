-- MORDISCO — ESTADOS REALES DE COCINA POR NÚMERO DE PEDIDO
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor.

drop function if exists public.kitchen_set_status_by_number(bigint,text);

create function public.kitchen_set_status_by_number(
  p_order_number bigint,
  p_new_status text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_current_status text;
  v_rows integer;
begin
  if p_new_status not in ('preparing','ready','delivered','cancelled') then
    raise exception 'Estado no permitido: %', p_new_status;
  end if;

  select status
  into v_current_status
  from public.orders
  where order_number=p_order_number
  order by created_at desc
  limit 1
  for update;

  if v_current_status is null then
    raise exception 'Pedido #% no encontrado', p_order_number;
  end if;

  if not (
    (v_current_status in ('pending','confirmed') and p_new_status in ('preparing','cancelled'))
    or (v_current_status='preparing' and p_new_status in ('ready','cancelled'))
    or (v_current_status='ready' and p_new_status='delivered')
    or v_current_status=p_new_status
  ) then
    raise exception 'Cambio no válido: % → %', v_current_status, p_new_status;
  end if;

  update public.orders
  set status=p_new_status,
      updated_at=now()
  where order_number=p_order_number;

  get diagnostics v_rows = row_count;

  if v_rows < 1 then
    raise exception 'No se actualizó ninguna fila para el pedido #% ', p_order_number;
  end if;

  return jsonb_build_object(
    'updated',true,
    'order_number',p_order_number,
    'previous_status',v_current_status,
    'status',p_new_status,
    'rows',v_rows
  );
end;
$$;

revoke all on function public.kitchen_set_status_by_number(bigint,text) from public;
grant execute on function public.kitchen_set_status_by_number(bigint,text) to anon, authenticated;

-- Prueba de lectura, no modifica nada:
select order_number,status,updated_at
from public.orders
where order_number in (26,27)
order by order_number;
