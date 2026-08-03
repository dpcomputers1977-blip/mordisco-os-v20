-- MORDISCO OS — CORRECCIÓN FINAL DE EXTRAS
-- No modifica productos, inventario ni pedidos anteriores.
-- Ejecutar una sola vez después del SQL 06.

create or replace function public.create_web_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_order_type text,
  p_notes text,
  p_items jsonb,
  p_payment_method text default 'cash',
  p_extras jsonb default '[]'::jsonb
)
returns table(order_id uuid, order_number bigint)
language plpgsql
security definer
set search_path=public
as $$
declare
  new_order public.orders%rowtype;
  item jsonb;
  extra_item jsonb;
  product_row public.products%rowtype;
  extra_row public.extra_options%rowtype;
  quantity_value integer;
  products_total numeric(12,2):=0;
  extras_total numeric(12,2):=0;
  extras_description text:='';
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

  if p_extras is null or jsonb_typeof(p_extras)<>'array' then
    p_extras:='[]'::jsonb;
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

    products_total:=products_total+(product_row.price*quantity_value);
  end loop;

  for extra_item in select * from jsonb_array_elements(p_extras)
  loop
    select * into extra_row
    from public.extra_options
    where id=(extra_item->>'extra_id')::uuid
      and active=true;

    if extra_row.id is not null then
      extras_total:=extras_total+extra_row.price;
      extras_description:=concat(
        extras_description,
        case when extras_description='' then '' else ', ' end,
        extra_row.name,
        ' (+$',
        to_char(extra_row.price,'FM999999990.00'),
        ')'
      );
    end if;
  end loop;

  insert into public.orders(
    customer_name,
    customer_phone,
    customer_address,
    order_type,
    payment_method,
    payment_status,
    notes,
    subtotal,
    delivery_cost,
    total,
    status
  )
  values(
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(coalesce(p_customer_address,'')),
    p_order_type,
    selected_payment,
    'unpaid',
    concat(
      '[WEB] ',
      trim(coalesce(p_notes,'')),
      case
        when extras_description<>'' then concat(
          case when nullif(trim(coalesce(p_notes,'')),'') is null then '' else E'\n' end,
          'Extras: ',
          extras_description
        )
        else ''
      end
    ),
    products_total+extras_total,
    0,
    products_total+extras_total,
    'pending'
  )
  returning * into new_order;

  for item in select * from jsonb_array_elements(p_items)
  loop
    quantity_value:=greatest(1,coalesce((item->>'quantity')::integer,1));

    select * into product_row
    from public.products
    where id=(item->>'product_id')::uuid and active=true;

    insert into public.order_items(
      order_id,
      product_id,
      product_name,
      unit_price,
      quantity,
      subtotal
    )
    values(
      new_order.id,
      product_row.id,
      product_row.name,
      product_row.price,
      quantity_value,
      product_row.price*quantity_value
    );
  end loop;

  return query select new_order.id,new_order.order_number;
end;
$$;

revoke all on function public.create_web_order(
  text,text,text,text,text,jsonb,text,jsonb
) from public;

grant execute on function public.create_web_order(
  text,text,text,text,text,jsonb,text,jsonb
) to anon,authenticated;

-- Verificación sin modificar datos:
select id,name,option_type,price,active
from public.extra_options
where active=true
order by option_type,sort_order,name;
