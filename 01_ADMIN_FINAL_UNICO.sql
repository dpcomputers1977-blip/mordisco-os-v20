-- MORDISCO OS FINAL ÚNICO
-- Ejecutar una sola vez en Supabase > SQL Editor.

insert into public.admin_users (user_id, full_name, active)
select
  id,
  case
    when email = 'dpcomputers1977+admin@gmail.com' then 'Administrador Mordisco'
    else 'Diego - Administrador Mordisco'
  end,
  true
from auth.users
where email in (
  'dpcomputers1977+admin@gmail.com',
  'dpcomputers1977@gmail.com'
)
on conflict (user_id)
do update set
  full_name = excluded.full_name,
  active = true;

select au.email, ad.full_name, ad.active
from public.admin_users ad
join auth.users au on au.id = ad.user_id
where au.email in (
  'dpcomputers1977+admin@gmail.com',
  'dpcomputers1977@gmail.com'
)
order by au.email;
