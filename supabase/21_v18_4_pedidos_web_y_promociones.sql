-- MORDISCO OS V15.2 — DESCUENTOS EN CAJA Y MÉTODOS DE PAGO
-- Ejecutar completo en Supabase SQL Editor.

alter table public.orders
  add column if not exists discount_type text not null default 'none'
  check(discount_type in ('none','percent','fixed'));

alter table public.orders
  add column if not exists discount_value numeric(12,2) not null default 0;

alter table public.orders
  add column if not exists discount_amount numeric(12,2) not null default 0;

create or replace function public.pay_order_with_discount(
  p_order_id uuid,
  p_payment_method text,
  p_received numeric,
  p_cashier_id uuid default null,
  p_discount_type text default 'none',
  p_discount_value numeric default 0
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  target_order public.orders%rowtype;
  admin_access boolean;
  cashier_access boolean;
  base_subtotal numeric(12,2);
  applied_discount numeric(12,2);
  final_total numeric(12,2);
begin
  select * into target_order
  from public.orders
  where id=p_order_id
  for update;

  if target_order.id is null then
    raise exception 'El pedido no existe';
  end if;

  if target_order.payment_status='paid' then
    raise exception 'El pedido ya está pagado';
  end if;

  if p_payment_method not in ('cash','card','transfer','deuna','ahorita') then
    raise exception 'Método de pago inválido';
  end if;

  if p_discount_type not in ('none','percent','fixed') then
    raise exception 'Tipo de descuento inválido';
  end if;

  admin_access := auth.uid() is not null and public.is_admin();

  cashier_access := exists(
    select 1
    from public.staff s
    where s.id=p_cashier_id
      and s.active=true
      and s.role='cashier'
  ) and exists(
    select 1
    from public.work_shifts w
    where w.staff_id=p_cashier_id
      and w.status='open'
  );

  if not admin_access and not cashier_access then
    raise exception 'Solo un administrador o cajero con turno abierto puede cobrar';
  end if;

  base_subtotal:=coalesce(target_order.subtotal,target_order.total,0);

  applied_discount:=case
    when p_discount_type='percent'
      then round(base_subtotal*(least(greatest(coalesce(p_discount_value,0),0),100)/100),2)
    when p_discount_type='fixed'
      then least(greatest(coalesce(p_discount_value,0),0),base_subtotal)
    else 0
  end;

  final_total:=greatest(0,round(base_subtotal-applied_discount,2));

  if p_payment_method='cash' and coalesce(p_received,0)<final_total then
    raise exception 'El efectivo recibido es menor al total final';
  end if;

  update public.orders
  set discount_type=p_discount_type,
      discount_value=case when p_discount_type='none' then 0 else greatest(coalesce(p_discount_value,0),0) end,
      discount_amount=applied_discount,
      total=final_total,
      payment_status='paid',
      payment_method=p_payment_method,
      amount_received=case when p_payment_method='cash' then p_received else final_total end,
      paid_at=now(),
      paid_by=p_cashier_id,
      cashier_id=coalesce(p_cashier_id,cashier_id),
      shift_id=coalesce(
        shift_id,
        (
          select id
          from public.work_shifts
          where staff_id=p_cashier_id
            and status='open'
          order by started_at desc
          limit 1
        )
      )
  where id=p_order_id;

  return true;
end;
$$;

revoke all on function public.pay_order_with_discount(uuid,text,numeric,uuid,text,numeric)
from public;

grant execute on function public.pay_order_with_discount(uuid,text,numeric,uuid,text,numeric)
to anon,authenticated;

-- El trigger de Contabilidad existente utiliza orders.total.
-- Al cobrar, orders.total ya contiene el valor final después del descuento.
