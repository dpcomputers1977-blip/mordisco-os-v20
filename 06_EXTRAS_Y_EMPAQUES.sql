-- MORDISCO OS — EXTRAS Y EMPAQUES ESPECIALES
-- No modifica productos, categorías, precios, inventario, empleados ni pedidos existentes.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create table if not exists public.extra_options(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  option_type text not null default 'extra'
    check(option_type in ('extra','packaging')),
  price numeric(10,2) not null default 0
    check(price >= 0),
  category_id uuid references public.categories(id) on delete set null,
  active boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists extra_options_active_idx
on public.extra_options(active,option_type,sort_order);

alter table public.extra_options enable row level security;

drop policy if exists "Extras públicos disponibles" on public.extra_options;
create policy "Extras públicos disponibles"
on public.extra_options
for select
to anon,authenticated
using(active = true or public.is_admin());

drop policy if exists "Administradores gestionan extras" on public.extra_options;
create policy "Administradores gestionan extras"
on public.extra_options
for all
to authenticated
using(public.is_admin())
with check(public.is_admin());

-- Opciones iniciales de ejemplo. Puedes editarlas o borrarlas desde el administrador.
insert into public.extra_options(name,description,option_type,price,active,featured,sort_order)
select 'Extra queso','Porción adicional de queso','extra',0.75,true,true,1
where not exists(select 1 from public.extra_options where lower(name)=lower('Extra queso'));

insert into public.extra_options(name,description,option_type,price,active,featured,sort_order)
select 'Extra jalapeños','Jalapeños adicionales','extra',0.50,true,false,2
where not exists(select 1 from public.extra_options where lower(name)=lower('Extra jalapeños'));

insert into public.extra_options(name,description,option_type,price,active,featured,sort_order)
select 'Caja térmica','Empaque especial para conservar la comida caliente por más tiempo','packaging',1.50,true,true,10
where not exists(select 1 from public.extra_options where lower(name)=lower('Caja térmica'));

select id,name,option_type,price,active
from public.extra_options
order by option_type,sort_order,name;
