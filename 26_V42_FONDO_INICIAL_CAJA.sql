-- MORDISCO OS V42 — FONDO INICIAL / SUELTOS AL ABRIR CAJA
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- No borra ventas, egresos ni movimientos existentes.

alter table public.cash_register_state
add column if not exists opening_cash numeric(12,2) not null default 0;

comment on column public.cash_register_state.opening_cash is
'Fondo inicial o sueltos registrados al abrir la caja. No se considera venta.';

select id,is_open,opening_cash,opened_at,closed_at
from public.cash_register_state
where id=1;
