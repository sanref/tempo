-- ═══════════════════════════════════════════════════════════════════════════
-- Reconstruye public.users desde auth.users — para después de un db:reset.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v admin_email="$ADMIN_EMAIL" \
--     -f db/perfiles-desde-auth.sql
--   (o `npm run db:perfiles`, que ya pasa admin_email)
--
-- Sin prefijo numérico a propósito: `migraciones()` en scripts/db.mjs solo
-- recoge `NN_*.sql`, así que esto no corre solo con `db:migrate` — hace falta
-- después de un `db:reset`, nunca antes.
--
-- Por qué hace falta: db/00_reset.sql borra `public.users` y no toca
-- `auth.users` — las cuentas reales de Supabase Auth siguen existiendo, pero
-- sin perfil. El trigger `on_auth_user_created` solo dispara al *registrarse*,
-- así que entrar con una cuenta que ya existía no lo recrea:
-- `getCurrentUser()` no encontraría fila y rebotaría a /login en bucle. Este
-- script hace a mano lo que hace el trigger, para todas las cuentas de auth
-- de una vez.
--
-- Idempotente por el ON CONFLICT (email): correrlo dos veces no duplica nada,
-- solo repone auth_id si hiciera falta.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

INSERT INTO public.users (email, nombre, role, auth_id)
SELECT au.email,
       coalesce(au.raw_user_meta_data->>'nombre', split_part(au.email, '@', 1)),
       'alumno',
       au.id
  FROM auth.users au
ON CONFLICT (email) DO UPDATE SET auth_id = EXCLUDED.auth_id;

-- El rol NO se lee de raw_user_meta_data: Supabase lo copia ahí al
-- registrarse y no lo vuelve a tocar, así que reponerlo desde ese campo
-- degradaría al admin a alumno en cuanto el dato quedara desactualizado. La
-- única fuente fiable de quién es admin es esta variable, a mano.
UPDATE public.users SET role = 'admin' WHERE email = :'admin_email';
