-- MORDISCO OS V11 — TURNOS DE TRABAJO Y COMANDAS
-- Ejecutar completo en Supabase SQL Editor.

create table if not exists public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  opening_cash numeric(12,2) not null default 0,
  closing_cash numeric(12,2),
  expected_cash numeric(12,2),
  difference numeric(12,2),
  sales_count integer not null default 0,
  sales_total numeric(12,2) not null default 0,
  status text not null default 'open' check(status in ('open','closed')),
  created_at timestamptz not null default now()
);

alter table public.orders
add column if not exists shift_id uuid references public.work_shifts(id) on delete set null;

create unique index if not exists one_open_shift_per_employee
on public.work_shifts(staff_id)
where status='open';

create index if not exists idx_work_shifts_started_at on public.work_shifts(started_at desc);
create index if not exists idx_orders_shift_id on public.orders(shift_id);

alter table public.work_shifts enable row level security;

drop policy if exists "Admins gestionan turnos" on public.work_shifts;
create policy "Admins gestionan turnos"
on public.work_shifts for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.start_work_shift(
  employee_id uuid,
  employee_pin text,
  initial_cash numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path=public,extensions
as $$
declare new_id uuid;
begin
  if not public.verify_staff_pin(employee_id,employee_pin) then
    raise exception 'PIN incorrecto';
  end if;
  if exists(select 1 from public.work_shifts where staff_id=employee_id and status='open') then
    raise exception 'El empleado ya tiene un turno abierto';
  end if;
  insert into public.work_shifts(staff_id,opening_cash)
  values(employee_id,greatest(coalesce(initial_cash,0),0))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.close_work_shift(
  employee_id uuid,
  employee_pin text,
  counted_cash numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path=public,extensions
as $$
declare shift_record public.work_shifts%rowtype;
declare cash_sales numeric;
declare total_sales numeric;
declare sales_qty integer;
begin
  if not public.verify_staff_pin(employee_id,employee_pin) then
    raise exception 'PIN incorrecto';
  end if;

  select * into shift_record
  from public.work_shifts
  where staff_id=employee_id and status='open'
  order by started_at desc limit 1;

  if shift_record.id is null then
    raise exception 'No existe un turno abierto';
  end if;

  select
    count(*),
    coalesce(sum(total),0),
    coalesce(sum(case when payment_method='cash' then total else 0 end),0)
  into sales_qty,total_sales,cash_sales
  from public.orders
  where shift_id=shift_record.id
    and status not in ('cancelled');

  update public.work_shifts
  set ended_at=now(),
      closing_cash=greatest(coalesce(counted_cash,0),0),
      expected_cash=opening_cash+cash_sales,
      difference=greatest(coalesce(counted_cash,0),0)-(opening_cash+cash_sales),
      sales_count=sales_qty,
      sales_total=total_sales,
      status='closed'
  where id=shift_record.id;

  return shift_record.id;
end;
$$;

create or replace function public.refresh_shift_totals()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.shift_id is not null then
    update public.work_shifts s
    set sales_count=(select count(*) from public.orders o where o.shift_id=s.id and o.status not in ('cancelled')),
        sales_total=(select coalesce(sum(o.total),0) from public.orders o where o.shift_id=s.id and o.status not in ('cancelled'))
    where s.id=new.shift_id and s.status='open';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_shift_totals on public.orders;
create trigger trg_refresh_shift_totals
after insert or update of total,status,shift_id on public.orders
for each row execute function public.refresh_shift_totals();

grant execute on function public.start_work_shift(uuid,text,numeric) to authenticated,anon;
grant execute on function public.close_work_shift(uuid,text,numeric) to authenticated,anon;

-- Lectura necesaria para la pantalla de comandas.
drop policy if exists "Personal consulta mesas" on public.restaurant_tables;
create policy "Personal consulta mesas"
on public.restaurant_tables for select to anon,authenticated
using (active=true);

drop policy if exists "Personal actualiza mesas" on public.restaurant_tables;
create policy "Personal actualiza mesas"
on public.restaurant_tables for update to anon,authenticated
using (active=true) with check (active=true);

drop policy if exists "Personal consulta productos" on public.products;
create policy "Personal consulta productos"
on public.products for select to anon,authenticated
using (active=true);

drop policy if exists "Personal consulta categorias" on public.categories;
create policy "Personal consulta categorias"
on public.categories for select to anon,authenticated
using (active=true);

drop policy if exists "Personal crea pedidos" on public.orders;
create policy "Personal crea pedidos"
on public.orders for insert to anon,authenticated
with check (true);

drop policy if exists "Personal consulta pedidos creados" on public.orders;
create policy "Personal consulta pedidos creados"
on public.orders for select to anon,authenticated
using (true);

drop policy if exists "Personal crea items" on public.order_items;
create policy "Personal crea items"
on public.order_items for insert to anon,authenticated
with check (true);
