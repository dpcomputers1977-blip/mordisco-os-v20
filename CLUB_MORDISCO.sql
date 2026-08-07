
-- ============================================================
-- CLUB MORDISCO — RECOMPENSAS DIGITALES
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor.
-- 1 punto por cada dólar pagado.
-- ============================================================

begin;

create table if not exists public.loyalty_transactions (
  id bigint generated always as identity primary key,
  customer_id uuid references public.customers(id) on delete set null,
  order_id text,
  order_number text,
  phone text not null,
  points integer not null,
  transaction_type text not null default 'earn'
    check (transaction_type in ('earn','redeem','adjustment')),
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists loyalty_transactions_one_earn_per_order
on public.loyalty_transactions(order_id)
where transaction_type='earn';

create index if not exists loyalty_transactions_phone_idx
on public.loyalty_transactions(phone);

alter table public.loyalty_transactions enable row level security;

-- No lectura pública directa. La tarjeta usa una función limitada.
revoke all on public.loyalty_transactions from anon;
revoke insert, update, delete on public.loyalty_transactions from authenticated;

create or replace function public.normalize_mordisco_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when regexp_replace(coalesce(p_phone,''),'\D','','g') like '593%'
      then '0' || substr(regexp_replace(coalesce(p_phone,''),'\D','','g'),4)
    else regexp_replace(coalesce(p_phone,''),'\D','','g')
  end;
$$;

create or replace function public.club_mordisco_award_points()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_phone text;
  v_points integer;
  v_customer_id uuid;
  v_existing integer;
begin
  if new.payment_status is distinct from 'paid' then
    return new;
  end if;

  if tg_op='UPDATE' and old.payment_status='paid' then
    return new;
  end if;

  v_phone := public.normalize_mordisco_phone(new.customer_phone);
  if length(v_phone)<8 then
    return new;
  end if;

  v_points := greatest(1,floor(coalesce(new.total,0))::integer);

  select count(*) into v_existing
  from public.loyalty_transactions
  where order_id=new.id::text
    and transaction_type='earn';

  if v_existing>0 then
    return new;
  end if;

  select id into v_customer_id
  from public.customers
  where public.normalize_mordisco_phone(phone)=v_phone
  order by updated_at desc nulls last
  limit 1;

  if v_customer_id is null then
    insert into public.customers(
      full_name,phone,email,tier,loyalty_points,
      order_count,total_spent,active,updated_at
    )
    values(
      coalesce(nullif(trim(new.customer_name),''),'Cliente Mordisco'),
      v_phone,null,'new',0,0,0,true,now()
    )
    returning id into v_customer_id;
  end if;

  update public.customers
  set
    full_name=coalesce(nullif(trim(new.customer_name),''),full_name),
    loyalty_points=coalesce(loyalty_points,0)+v_points,
    order_count=coalesce(order_count,0)+1,
    total_spent=coalesce(total_spent,0)+coalesce(new.total,0),
    tier=case
      when coalesce(loyalty_points,0)+v_points>=300 then 'vip'
      when coalesce(loyalty_points,0)+v_points>=60 then 'frequent'
      else 'new'
    end,
    updated_at=now()
  where id=v_customer_id;

  insert into public.loyalty_transactions(
    customer_id,order_id,order_number,phone,points,
    transaction_type,description
  )
  values(
    v_customer_id,new.id::text,new.order_number::text,v_phone,v_points,
    'earn','Puntos obtenidos por pedido #'||coalesce(new.order_number::text,new.id::text)
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_club_mordisco_award_points on public.orders;

create trigger trg_club_mordisco_award_points
after insert or update of payment_status
on public.orders
for each row
execute function public.club_mordisco_award_points();

-- Consulta pública limitada: no devuelve correo, dirección ni teléfono completo.
create or replace function public.club_mordisco_lookup(p_phone text)
returns table(
  full_name text,
  loyalty_points integer,
  tier text,
  order_count integer,
  total_spent numeric
)
language sql
security definer
set search_path=public
as $$
  select
    c.full_name,
    coalesce(c.loyalty_points,0)::integer,
    coalesce(c.tier,'new'),
    coalesce(c.order_count,0)::integer,
    coalesce(c.total_spent,0)
  from public.customers c
  where public.normalize_mordisco_phone(c.phone)
    = public.normalize_mordisco_phone(p_phone)
    and c.active is distinct from false
  order by c.updated_at desc nulls last
  limit 1;
$$;

grant execute on function public.club_mordisco_lookup(text) to anon, authenticated;

commit;

select
  'CLUB MORDISCO ACTIVO' as estado,
  count(*) as clientes_actuales
from public.customers;
