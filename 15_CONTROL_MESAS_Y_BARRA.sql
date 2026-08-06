-- ============================================================
-- MORDISCO — CONTROL DE MESAS Y BARRA
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor
-- ============================================================

alter table public.restaurant_tables
add column if not exists service_type text not null default 'table';

alter table public.restaurant_tables
drop constraint if exists restaurant_tables_service_type_check;

alter table public.restaurant_tables
add constraint restaurant_tables_service_type_check
check (service_type in ('table','bar'));

create or replace function public.admin_save_service_point(
  p_id uuid,
  p_name text,
  p_seats integer,
  p_service_type text,
  p_sort_order integer
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede modificar mesas y barras';
  end if;

  if trim(coalesce(p_name,''))='' then
    raise exception 'El nombre es obligatorio';
  end if;

  if p_service_type not in ('table','bar') then
    raise exception 'Tipo de espacio no válido';
  end if;

  if p_id is null then
    insert into public.restaurant_tables(
      name,seats,service_type,sort_order,status
    )
    values(
      trim(p_name),
      greatest(coalesce(p_seats,1),1),
      p_service_type,
      coalesce(p_sort_order,1),
      'free'
    )
    returning id into v_id;
  else
    update public.restaurant_tables
    set
      name=trim(p_name),
      seats=greatest(coalesce(p_seats,1),1),
      service_type=p_service_type,
      sort_order=coalesce(p_sort_order,sort_order),
      updated_at=now()
    where id=p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Espacio no encontrado';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.admin_delete_service_point(
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede eliminar mesas y barras';
  end if;

  select status
  into v_status
  from public.restaurant_tables
  where id=p_id
  for update;

  if v_status is null then
    raise exception 'Espacio no encontrado';
  end if;

  if v_status<>'free' then
    raise exception 'No se puede eliminar un espacio con una orden activa';
  end if;

  if exists(
    select 1
    from public.orders
    where table_id=p_id
      and status not in ('delivered','cancelled','paid')
  ) then
    raise exception 'Este espacio todavía tiene pedidos activos';
  end if;

  delete from public.restaurant_tables
  where id=p_id;
end;
$$;

revoke all on function public.admin_save_service_point(uuid,text,integer,text,integer) from public;
revoke all on function public.admin_delete_service_point(uuid) from public;

grant execute on function public.admin_save_service_point(uuid,text,integer,text,integer)
to authenticated;

grant execute on function public.admin_delete_service_point(uuid)
to authenticated;

select id,name,seats,service_type,status
from public.restaurant_tables
order by sort_order,name;
