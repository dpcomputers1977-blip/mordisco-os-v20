-- MORDISCO OS — PERMITIR LEER CONFIGURACIÓN PÚBLICA
-- No modifica productos, ventas, inventario, empleados ni pedidos.
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.business_settings enable row level security;

drop policy if exists "Configuración pública del negocio" on public.business_settings;

create policy "Configuración pública del negocio"
on public.business_settings
for select
to anon, authenticated
using (id = 1);

-- Verificación
select id, name, whatsapp, address, schedule, accepting_orders
from public.business_settings
where id = 1;
