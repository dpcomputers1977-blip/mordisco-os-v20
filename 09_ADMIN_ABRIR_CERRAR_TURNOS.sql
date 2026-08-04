-- MORDISCO — ADMINISTRADOR ABRE Y CIERRA TURNOS
-- Ejecutar una sola vez en Supabase > SQL Editor.

create or replace function public.admin_open_work_shift(
  p_employee_id uuid,
  p_initial_cash numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_shift_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el administrador puede abrir turnos';
  end if;

  if not exists(
    select 1 from public.staff
    where id=p_employee_id and active=true
  ) then
    raise exception 'El empleado no existe o está inactivo';
  end if;

  if exists(
    select 1 from public.work_shifts
    where staff_id=p_employee_id and status='open'
  ) then
    raise exception 'El empleado ya tiene un turno abierto';
  end if;

  insert into public.work_shifts(staff_id,opening_cash)
  values(p_employee_id,greatest(coalesce(p_initial_cash,0),0))
  returning id into new_shift_id;

  return new_shift_id;
end;
$$;

create or replace function public.admin_close_work_shift(
  p_employee_id uuid,
  p_counted_cash numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  target_shift public.work_shifts%rowtype;
  cash_sales numeric;
  total_sales numeric;
  sales_qty integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el administrador puede cerrar turnos';
  end if;

  select * into target_shift
  from public.work_shifts
  where staff_id=p_employee_id and status='open'
  order by started_at desc
  limit 1
  for update;

  if target_shift.id is null then
    raise exception 'El empleado no tiene un turno abierto';
  end if;

  select
    count(*),
    coalesce(sum(total),0),
    coalesce(sum(case when payment_method='cash' then total else 0 end),0)
  into sales_qty,total_sales,cash_sales
  from public.orders
  where shift_id=target_shift.id
    and status<>'cancelled';

  update public.work_shifts
  set ended_at=now(),
      closing_cash=greatest(coalesce(p_counted_cash,0),0),
      expected_cash=opening_cash+cash_sales,
      difference=greatest(coalesce(p_counted_cash,0),0)-(opening_cash+cash_sales),
      sales_count=sales_qty,
      sales_total=total_sales,
      status='closed'
  where id=target_shift.id;

  return target_shift.id;
end;
$$;

revoke all on function public.admin_open_work_shift(uuid,numeric) from public;
revoke all on function public.admin_close_work_shift(uuid,numeric) from public;

grant execute on function public.admin_open_work_shift(uuid,numeric) to authenticated;
grant execute on function public.admin_close_work_shift(uuid,numeric) to authenticated;
