-- MORDISCO OS V12 — CONTABILIDAD, CLIENTES, PROMOCIONES Y SUBPÁGINAS
-- Ejecutar completo en Supabase SQL Editor después de los SQL anteriores.

create table if not exists public.financial_movements(
 id uuid primary key default gen_random_uuid(),
 type text not null check(type in ('income','expense')),
 category text not null,
 description text not null,
 amount numeric(12,2) not null check(amount>0),
 payment_method text not null default 'cash',
 movement_date date not null default current_date,
 reference text,
 staff_id uuid references public.staff(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.customers(
 id uuid primary key default gen_random_uuid(),
 full_name text not null,
 phone text,
 email text,
 address text,
 birthday date,
 notes text,
 tier text not null default 'new' check(tier in ('new','frequent','vip')),
 loyalty_points integer not null default 0,
 order_count integer not null default 0,
 total_spent numeric(12,2) not null default 0,
 last_order_at timestamptz,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists customers_phone_unique on public.customers(phone) where phone is not null and phone<>'';

alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;

create table if not exists public.promotions(
 id uuid primary key default gen_random_uuid(),
 title text not null,
 badge text,
 description text not null,
 promo_price numeric(12,2),
 image_url text,
 starts_on date,
 ends_on date,
 link_url text,
 featured boolean not null default false,
 active boolean not null default true,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.content_pages(
 id uuid primary key default gen_random_uuid(),
 title text not null,
 slug text not null unique,
 summary text,
 hero_image text,
 content text not null,
 button_text text,
 button_link text,
 show_in_menu boolean not null default false,
 published boolean not null default true,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists idx_finance_date on public.financial_movements(movement_date desc);
create index if not exists idx_customers_name on public.customers(full_name);
create index if not exists idx_promotions_active on public.promotions(active,sort_order);
create index if not exists idx_pages_published on public.content_pages(published,sort_order);

alter table public.financial_movements enable row level security;
alter table public.customers enable row level security;
alter table public.promotions enable row level security;
alter table public.content_pages enable row level security;

drop policy if exists "Admin contabilidad" on public.financial_movements;
create policy "Admin contabilidad" on public.financial_movements for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Admin clientes" on public.customers;
create policy "Admin clientes" on public.customers for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Registro publico clientes" on public.customers;
create policy "Registro publico clientes" on public.customers for insert to anon,authenticated with check(true);

drop policy if exists "Promociones publicas" on public.promotions;
create policy "Promociones publicas" on public.promotions for select to anon,authenticated using(active=true or public.is_admin());
drop policy if exists "Admin promociones" on public.promotions;
create policy "Admin promociones" on public.promotions for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Paginas publicas" on public.content_pages;
create policy "Paginas publicas" on public.content_pages for select to anon,authenticated using(published=true or public.is_admin());
drop policy if exists "Admin paginas" on public.content_pages;
create policy "Admin paginas" on public.content_pages for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.upsert_customer_from_order(
 p_name text,p_phone text,p_email text default null,p_address text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 if coalesce(trim(p_phone),'')='' then return null; end if;
 insert into public.customers(full_name,phone,email,address)
 values(coalesce(nullif(trim(p_name),''),'Cliente'),trim(p_phone),nullif(trim(p_email),''),nullif(trim(p_address),''))
 on conflict(phone) where phone is not null and phone<>''
 do update set full_name=excluded.full_name,email=coalesce(excluded.email,customers.email),address=coalesce(excluded.address,customers.address),updated_at=now()
 returning id into cid;
 return cid;
end; $$;
grant execute on function public.upsert_customer_from_order(text,text,text,text) to anon,authenticated;

create or replace function public.update_customer_stats() returns trigger language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 cid:=new.customer_id;
 if cid is null and coalesce(new.customer_phone,'')<>'' then
   cid:=public.upsert_customer_from_order(new.customer_name,new.customer_phone,null,new.customer_address);
   update public.orders set customer_id=cid where id=new.id and customer_id is null;
 end if;
 if cid is not null then
   update public.customers c set
    order_count=(select count(*) from public.orders o where o.customer_id=c.id and o.status<>'cancelled'),
    total_spent=(select coalesce(sum(total),0) from public.orders o where o.customer_id=c.id and o.status<>'cancelled'),
    last_order_at=(select max(created_at) from public.orders o where o.customer_id=c.id and o.status<>'cancelled'),
    tier=case
      when (select coalesce(sum(total),0) from public.orders o where o.customer_id=c.id and o.status<>'cancelled')>=200 then 'vip'
      when (select count(*) from public.orders o where o.customer_id=c.id and o.status<>'cancelled')>=5 then 'frequent'
      else c.tier end,
    updated_at=now()
   where c.id=cid;
 end if;
 return new;
end; $$;
drop trigger if exists trg_update_customer_stats on public.orders;
create trigger trg_update_customer_stats after insert or update of status,total,customer_id on public.orders for each row execute function public.update_customer_stats();

insert into public.promotions(title,badge,description,promo_price,featured,active,sort_order)
select 'Combo Mordisco','Oferta','Hamburguesa, papas y bebida a un precio especial.',5.99,true,true,1
where not exists(select 1 from public.promotions);
