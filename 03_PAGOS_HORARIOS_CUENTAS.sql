-- MORDISCO OS — PAGOS WEB, HORARIOS Y CUENTAS
-- Ejecutar una sola vez en Supabase > SQL Editor.

-- 1. HORARIOS DE ATENCIÓN
create table if not exists public.business_hours(
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null unique check(day_of_week between 0 and 6),
  opens_at time not null default '11:00',
  closes_at time not null default '22:00',
  closed boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.business_hours enable row level security;

drop policy if exists "Horarios públicos" on public.business_hours;
create policy "Horarios públicos"
on public.business_hours for select
to anon,authenticated
using(true);

drop policy if exists "Admin gestiona horarios" on public.business_hours;
create policy "Admin gestiona horarios"
on public.business_hours for all
to authenticated
using(public.is_admin())
with check(public.is_admin());

insert into public.business_hours(day_of_week,opens_at,closes_at,closed,sort_order)
values
(1,'11:00','22:00',false,0),
(2,'11:00','22:00',false,1),
(3,'11:00','22:00',false,2),
(4,'11:00','22:00',false,3),
(5,'11:00','23:00',false,4),
(6,'11:00','23:00',false,5),
(0,'11:00','22:00',false,6)
on conflict(day_of_week) do nothing;

-- 2. CUENTAS POR COBRAR Y PAGAR
create table if not exists public.finance_accounts(
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('receivable','payable')),
  party_name text not null,
  description text not null,
  amount numeric(12,2) not null check(amount>0),
  paid_amount numeric(12,2) not null default 0 check(paid_amount>=0),
  due_date date not null,
  status text not null default 'pending' check(status in ('pending','partial','paid')),
  payment_method text not null default 'cash',
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_accounts_due_idx
on public.finance_accounts(status,due_date);

alter table public.finance_accounts enable row level security;

drop policy if exists "Admin gestiona cuentas" on public.finance_accounts;
create policy "Admin gestiona cuentas"
on public.finance_accounts for all
to authenticated
using(public.is_admin())
with check(public.is_admin());

-- 3. PEDIDOS WEB CON MÉTODO DE PAGO
create or replace function public.create_web_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_order_type text,
  p_notes text,
  p_items jsonb,
  p_payment_method text default 'cash'
)
returns table(order_id uuid, order_number bigint)
language plpgsql
security definer
set search_path=public
as $$
declare
  new_order public.orders%rowtype;
  item jsonb;
  product_row public.products%rowtype;
  quantity_value integer;
  calculated_total numeric(12,2):=0;
  selected_payment text;
begin
  if nullif(trim(p_customer_name),'') is null then
    raise exception 'El nombre es obligatorio';
  end if;

  if nullif(trim(p_customer_phone),'') is null then
    raise exception 'El teléfono es obligatorio';
  end if;

  if p_order_type not in ('pickup','delivery') then
    raise exception 'Tipo de pedido inválido';
  end if;

  if p_order_type='delivery' and nullif(trim(p_customer_address),'') is null then
    raise exception 'La dirección es obligatoria';
  end if;

  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception 'El pedido no tiene productos';
  end if;

  selected_payment:=case
    when p_payment_method in ('cash','transfer','card') then p_payment_method
    else 'cash'
  end;

  for item in select * from jsonb_array_elements(p_items)
  loop
    quantity_value:=greatest(1,coalesce((item->>'quantity')::integer,1));

    select * into product_row
    from public.products
    where id=(item->>'product_id')::uuid and active=true;

    if product_row.id is null then
      raise exception 'Uno de los productos no está disponible';
    end if;

    calculated_total:=calculated_total+(product_row.price*quantity_value);
  end loop;

  insert into public.orders(
    customer_name,customer_phone,customer_address,order_type,
    payment_method,payment_status,notes,subtotal,delivery_cost,total,status
  )
  values(
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(coalesce(p_customer_address,'')),
    p_order_type,
    selected_payment,
    'unpaid',
    concat('[WEB] ',trim(coalesce(p_notes,''))),
    calculated_total,0,calculated_total,'pending'
  )
  returning * into new_order;

  for item in select * from jsonb_array_elements(p_items)
  loop
    quantity_value:=greatest(1,coalesce((item->>'quantity')::integer,1));

    select * into product_row
    from public.products
    where id=(item->>'product_id')::uuid and active=true;

    insert into public.order_items(
      order_id,product_id,product_name,unit_price,quantity,subtotal
    )
    values(
      new_order.id,product_row.id,product_row.name,product_row.price,
      quantity_value,product_row.price*quantity_value
    );
  end loop;

  return query select new_order.id,new_order.order_number;
end;
$$;

revoke all on function public.create_web_order(text,text,text,text,text,jsonb,text) from public;
grant execute on function public.create_web_order(text,text,text,text,text,jsonb,text)
to anon,authenticated;
