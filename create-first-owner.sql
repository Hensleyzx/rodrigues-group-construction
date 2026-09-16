-- 1) Primeiro crie o usuário em Supabase > Authentication > Users > Add user.
-- 2) Copie o UUID desse usuário e substitua abaixo.
-- 3) Rode somente este INSERT no SQL Editor.

insert into public.owner_profiles (user_id, display_name, role)
values ('COLE_AQUI_O_UUID_DO_USUARIO'::uuid, 'Rodrigues Group Owner', 'admin')
on conflict (user_id) do update set
  display_name = excluded.display_name,
  role = excluded.role;
