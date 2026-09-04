-- ═══════════════════════════════════════════════════════════════════════════
-- 09 — El admin puede editar el catálogo común
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/09_admin_ejercicios.sql
--   (o `npm run db:migrate`, que corre todos los 0N_ en orden)
--
-- Es idempotente: `CREATE OR REPLACE` para la función y DROP + CREATE para
-- cada política, igual que 04_auth.sql. Correrla dos veces no cambia nada.
--
-- Qué resuelve:
--
--   Los ejercicios del catálogo común no tenían quien los arreglara. Todo lo
--   que vino del seed tiene `created_by` a NULL, así que no era «de» nadie:
--   una errata en un nombre, un grupo muscular mal puesto o una foto enlazada
--   al movimiento equivocado solo se corregían entrando por SQL.
--
--   Ahora un admin puede editarlos y borrarlos desde `/ejercicios`, y también
--   publicar o despublicar. El resto de la gente sigue igual que antes: solo
--   lo suyo y privado.
--
-- Va **después** de 04_auth.sql a propósito y no editando aquel: `db:migrate`
-- los corre a los dos en orden en cada pasada, así que si se cambiara la 04 y
-- alguien no la hubiera corrido quedaría con políticas viejas. Poniéndolo al
-- final, lo último que se ejecuta siempre es esto.
--
-- Nota sobre el alcance: se abren UPDATE y DELETE, **no SELECT**. Un admin
-- sigue viendo lo mismo que los demás —el catálogo común y lo suyo— porque
-- poder arreglar el catálogo compartido no es lo mismo que poder leer los
-- ejercicios privados de cada persona.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

DO $$
BEGIN
  -- Igual que 04_auth.sql: sin el esquema `auth` (un Postgres pelado, sin
  -- Supabase) no hay JWT del que sacar nada y no hay políticas que poner.
  IF to_regnamespace('auth') IS NULL THEN
    RAISE NOTICE 'Sin esquema auth: me salto las políticas de admin.';
    RETURN;
  END IF;

  -- El rol sale de `users`, no del JWT: Supabase copia el rol en
  -- `user_metadata` al registrarse y no lo vuelve a tocar, así que un ascenso
  -- a admin no se vería hasta que la persona volviera a entrar.
  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.es_admin()
  RETURNS boolean AS $body$
    SELECT coalesce(
      (SELECT role = 'admin' FROM public.users WHERE auth_id = auth.uid() LIMIT 1),
      false);
  $body$ LANGUAGE sql STABLE SECURITY DEFINER;
  $fn$;

  EXECUTE 'DROP POLICY IF EXISTS exercises_update_own ON exercises';
  EXECUTE 'CREATE POLICY exercises_update_own ON exercises FOR UPDATE TO authenticated
             USING (created_by = public.current_user_id() OR public.es_admin())
             WITH CHECK (created_by = public.current_user_id() OR public.es_admin())';

  EXECUTE 'DROP POLICY IF EXISTS exercises_delete_own ON exercises';
  EXECUTE 'CREATE POLICY exercises_delete_own ON exercises FOR DELETE TO authenticated
             USING (created_by = public.current_user_id() OR public.es_admin())';
END $$;

-- Comprobación rápida.
SELECT policyname, cmd
  FROM pg_policies
 WHERE tablename = 'exercises'
 ORDER BY policyname;
