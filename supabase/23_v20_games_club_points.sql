-- ============================================================
-- MORDISCO GAMES + CLUB MORDISCO
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor.
--
-- Seguridad aplicada:
--   * +1 punto solo mediante RPC (sin INSERT/UPDATE directo desde el navegador)
--   * un mismo juego+nivel solo puede premiar una vez por cliente por día
--   * máximo 5 puntos de juegos por cliente por día
--   * solo premia teléfonos que ya existen en public.customers
-- ============================================================

begin;

create table if not exists public.game_point_awards (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  phone text not null,
  game_key text not null,
  level_no integer not null check (level_no > 0),
  award_date date not null default ((now() at time zone 'America/Guayaquil')::date),
  created_at timestamptz not null default now()
);

create unique index if not exists game_point_awards_once_per_level_day
  on public.game_point_awards(customer_id, game_key, level_no, award_date);

create index if not exists game_point_awards_customer_date_idx
  on public.game_point_awards(customer_id, award_date);

alter table public.game_point_awards enable row level security;
revoke all on public.game_point_awards from anon, authenticated;

create or replace function public.club_mordisco_game_award(
  p_phone text,
  p_game text,
  p_level integer
)
returns table(
  awarded boolean,
  balance integer,
  daily_game_points integer,
  message text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_balance integer;
  v_today date := (now() at time zone 'America/Guayaquil')::date;
  v_daily integer := 0;
  v_max_level integer;
  v_inserted bigint;
begin
  v_phone := public.normalize_mordisco_phone(p_phone);

  if length(v_phone) < 8 then
    return query select false, 0, 0, 'Ingresa un teléfono válido.'::text;
    return;
  end if;

  v_max_level := case lower(trim(p_game))
    when 'rush' then 2
    when 'maze' then 6
    when 'kitchen' then 3
    when 'memory' then 5
    when 'tower' then 5
    when 'catch' then 5
    else 0
  end;

  if v_max_level = 0 or p_level < 1 or p_level > v_max_level then
    return query select false, 0, 0, 'Juego o nivel no válido.'::text;
    return;
  end if;

  -- Bloquea la fila del cliente durante la operación para evitar dobles premios simultáneos.
  select c.id, coalesce(c.loyalty_points,0)::integer
    into v_customer_id, v_balance
  from public.customers c
  where public.normalize_mordisco_phone(c.phone)=v_phone
    and c.active is distinct from false
  order by c.updated_at desc nulls last
  limit 1
  for update;

  if v_customer_id is null then
    return query select false, 0, 0,
      'No encontramos ese teléfono en Club Mordisco. Usa el mismo número de tus pedidos.'::text;
    return;
  end if;

  select count(*)::integer into v_daily
  from public.game_point_awards g
  where g.customer_id=v_customer_id and g.award_date=v_today;

  if v_daily >= 5 then
    return query select false, v_balance, v_daily,
      'Ya alcanzaste el máximo de 5 puntos de juegos por hoy.'::text;
    return;
  end if;

  insert into public.game_point_awards(customer_id,phone,game_key,level_no,award_date)
  values(v_customer_id,v_phone,lower(trim(p_game)),p_level,v_today)
  on conflict (customer_id,game_key,level_no,award_date) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return query select false, v_balance, v_daily,
      'Ese nivel ya entregó su punto hoy.'::text;
    return;
  end if;

  update public.customers
  set loyalty_points=coalesce(loyalty_points,0)+1,
      tier=case
        when coalesce(loyalty_points,0)+1>=300 then 'vip'
        when coalesce(loyalty_points,0)+1>=60 then 'frequent'
        else 'new'
      end,
      updated_at=now()
  where id=v_customer_id
  returning loyalty_points::integer into v_balance;

  insert into public.loyalty_transactions(
    customer_id,order_id,order_number,phone,points,transaction_type,description
  ) values(
    v_customer_id,
    'game:'||v_today::text||':'||v_customer_id::text||':'||lower(trim(p_game))||':'||p_level::text,
    null,
    v_phone,
    1,
    'adjustment',
    'Juego Mordisco: '||lower(trim(p_game))||' · nivel '||p_level::text
  );

  v_daily := v_daily + 1;
  return query select true, v_balance, v_daily,
    ('+1 Mordisco Club Point · saldo: '||v_balance::text)::text;
end;
$$;

revoke all on function public.club_mordisco_game_award(text,text,integer) from public;
grant execute on function public.club_mordisco_game_award(text,text,integer) to anon, authenticated;

commit;

select 'MORDISCO GAMES CLUB ACTIVO' as estado;
