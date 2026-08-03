-- MORDISCO OS V13.12 — ENVIAR A COCINA Y COBRAR DESPUÉS
-- Ejecutar completo en Supabase SQL Editor.

alter table public.orders
  add column if not exists payment_status text not null default 'paid'
  check(payment_status in ('unpaid','paid'));

alter table public.orders
  add column if not exists paid_at timestamptz;

alter table public.orders
  add column if not exists paid_by uuid references public.staff(id) on delete set null;

alter table public.orders
  add column if not exists amount_received numeric(12,2);

-- Las ventas anteriores se mantienen como pagadas.
update public.orders
set payment_status='paid',
    paid_at=coalesce(paid_at,created_at)
where payment_status is null;

create or replace function public.pay_order(
  p_order_id uuid,
  p_payment_method text,
  p_received numeric,
  p_cashier_id uuid default null
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
begin
  select * into target_order from public.orders where id=p_order_id for update;
  if target_order.id is null then raise exception 'El pedido no existe'; end if;
  if target_order.payment_status='paid' then raise exception 'El pedido ya está pagado'; end if;
  if p_payment_method not in ('cash','card','transfer') then raise exception 'Método de pago inválido'; end if;
  if p_payment_method='cash' and coalesce(p_received,0)<target_order.total then
    raise exception 'El efectivo recibido es menor al total';
  end if;

  admin_access := auth.uid() is not null and public.is_admin();

  cashier_access := exists(
    select 1 from public.staff s
    where s.id=p_cashier_id and s.active=true and s.role='cashier'
  ) and exists(
    select 1 from public.work_shifts w
    where w.staff_id=p_cashier_id and w.status='open'
  );

  if not admin_access and not cashier_access then
    raise exception 'Solo un administrador o cajero con turno abierto puede cobrar';
  end if;

  update public.orders
  set payment_status='paid',
      payment_method=p_payment_method,
      amount_received=case when p_payment_method='cash' then p_received else total end,
      paid_at=now(),
      paid_by=p_cashier_id,
      cashier_id=coalesce(p_cashier_id,cashier_id),
      shift_id=coalesce(
        shift_id,
        (select id from public.work_shifts
         where staff_id=p_cashier_id and status='open'
         order by started_at desc limit 1)
      )
  where id=p_order_id;

  return true;
end;
$$;

revoke all on function public.pay_order(uuid,text,numeric,uuid) from public;
grant execute on function public.pay_order(uuid,text,numeric,uuid) to anon,authenticated;

-- Contabilidad únicamente después del cobro.
create or replace function public.sync_order_to_accounting()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    delete from public.financial_movements where order_id=old.id;
    return old;
  end if;

  if new.status='cancelled' or new.payment_status<>'paid' then
    delete from public.financial_movements where order_id=new.id;
    return new;
  end if;

  insert into public.financial_movements(
    type,category,description,amount,payment_method,movement_date,
    reference,staff_id,source,order_id,created_at,updated_at
  )
  values(
    'income','Ventas',
    'Venta #'||coalesce(new.order_number::text,left(new.id::text,8)),
    new.total,coalesce(new.payment_method,'cash'),
    (coalesce(new.paid_at,now()) at time zone 'America/Guayaquil')::date,
    'Pedido '||coalesce(new.order_number::text,new.id::text),
    coalesce(new.paid_by,new.cashier_id),
    'sale',new.id,now(),now()
  )
  on conflict(order_id) where order_id is not null
  do update set
    amount=excluded.amount,
    payment_method=excluded.payment_method,
    movement_date=excluded.movement_date,
    staff_id=excluded.staff_id,
    description=excluded.description,
    updated_at=now();

  return new;
end;
$$;

drop trigger if exists trg_sync_order_to_accounting on public.orders;
create trigger trg_sync_order_to_accounting
after insert or update of total,status,payment_method,payment_status,paid_at,paid_by,cashier_id
on public.orders
for each row execute function public.sync_order_to_accounting();

-- Eliminar ingresos generados para pedidos aún no pagados.
delete from public.financial_movements fm
using public.orders o
where fm.order_id=o.id and o.payment_status<>'paid';
