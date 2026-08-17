-- ═══════════════════════════════════════════════════════════════════════════
-- 04 — Supabase Auth: vínculo de identidad y políticas RLS
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/04_auth.sql
--
-- Hasta aquí la app entraba con un usuario mockeado (MOCK_USER_ID) y las
-- tablas tenían RLS activada y ninguna política: nadie pasaba por la puerta de
-- PostgREST y la app entraba por la de atrás, con el rol dueño.
--
-- Ahora hay dos clientes sobre la misma base:
--
--   · tempo (web)    — Server Components; sigue leyendo por DATABASE_URL con
--                      el rol dueño, que salta RLS. Usa Auth solo para saber
--                      quién es: traduce auth.users.id → users.id.
--   · tempo_mobile   — SPA con la clave publicable en el navegador. Todo lo
--                      que lee y escribe pasa por RLS, así que sin las
--                      políticas de abajo no ve nada.
--
-- Por eso las políticas se escriben pensando en el móvil, y el web se protege
-- como siempre: comprobando la propiedad de cada fila en las server actions.
--
-- Los RPC que usa el móvil (empezar_sesion, guardar_series, get_resumen_semana…)
-- NO viven aquí, sino en tempo_mobile/supabase/migrations/01_mobile_auth_and_rls.sql.
--
-- Idempotente: se puede correr dos veces seguidas.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

-- ── 1. Identidad ───────────────────────────────────────────────────────────
-- Sin clave ajena contra auth.users: `auth` es de Supabase y atar el esquema a
-- su ciclo de vida hace que un `db:reset` dependa de tablas que no controlamos.
-- El vínculo lo mantiene el trigger de más abajo.

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_id_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_id_key UNIQUE (auth_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_auth_id_idx ON users (auth_id);

-- ── 2. Lo que depende del schema `auth` ────────────────────────────────────
-- En Postgres local no existe: la columna de arriba se queda puesta y esto se
-- salta, para que la base de desarrollo siga levantando sin Supabase.

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
  RAISE NOTICE 'Sin schema `auth` (Postgres local): me salto trigger y políticas.';
  RETURN;
END IF;

-- Perfil automático al registrarse. Lee `raw_user_meta_data`, que es lo que
-- manda el cliente en options.data del signUp.
--
-- El ON CONFLICT es lo que permite que una fila que ya existía —las del seed—
-- se enganche a una cuenta nueva en vez de reventar por el índice de email.
EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $body$
BEGIN
  INSERT INTO public.users (auth_id, email, nombre, role, activo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    (COALESCE(NEW.raw_user_meta_data->>'role', 'alumno'))::public.user_role,
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_id = EXCLUDED.auth_id,
    nombre  = EXCLUDED.nombre,
    role    = EXCLUDED.role,
    activo  = EXCLUDED.activo;
  RETURN NEW;
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;
$fn$;

EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
EXECUTE 'CREATE TRIGGER on_auth_user_created
           AFTER INSERT ON auth.users
           FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';

-- El id interno a partir del JWT. Todas las políticas cuelgan de esto.
EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid AS $body$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$body$ LANGUAGE sql STABLE SECURITY DEFINER;
$fn$;

-- ── 3. Políticas ─────────────────────────────────────────────────────────
-- RLS ya está activada en 01_schema.sql. Se recrean siempre (DROP + CREATE)
-- para que correr esto dos veces deje exactamente el mismo estado.

-- users: su propia fila, y las de sus alumnos si es entrenador.
EXECUTE 'DROP POLICY IF EXISTS users_select_own ON users';
EXECUTE 'CREATE POLICY users_select_own ON users FOR SELECT TO authenticated
           USING (auth_id = auth.uid() OR coach_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS users_update_own ON users';
EXECUTE 'CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated
           USING (auth_id = auth.uid()) WITH CHECK (auth_id = auth.uid())';

-- exercises: el catálogo común más lo propio. Mismo criterio que getEjercicios().
EXECUTE 'DROP POLICY IF EXISTS exercises_select_visible ON exercises';
EXECUTE 'CREATE POLICY exercises_select_visible ON exercises FOR SELECT TO authenticated
           USING (es_publico OR created_by = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS exercises_insert_own ON exercises';
EXECUTE 'CREATE POLICY exercises_insert_own ON exercises FOR INSERT TO authenticated
           WITH CHECK (created_by = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS exercises_update_own ON exercises';
EXECUTE 'CREATE POLICY exercises_update_own ON exercises FOR UPDATE TO authenticated
           USING (created_by = public.current_user_id())
           WITH CHECK (created_by = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS exercises_delete_own ON exercises';
EXECUTE 'CREATE POLICY exercises_delete_own ON exercises FOR DELETE TO authenticated
           USING (created_by = public.current_user_id())';

-- routines: propias, o escritas por uno como entrenador.
EXECUTE 'DROP POLICY IF EXISTS routines_select_own ON routines';
EXECUTE 'CREATE POLICY routines_select_own ON routines FOR SELECT TO authenticated
           USING (owner_id = public.current_user_id() OR author_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS routines_insert_own ON routines';
EXECUTE 'CREATE POLICY routines_insert_own ON routines FOR INSERT TO authenticated
           WITH CHECK (owner_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS routines_update_own ON routines';
EXECUTE 'CREATE POLICY routines_update_own ON routines FOR UPDATE TO authenticated
           USING (owner_id = public.current_user_id())
           WITH CHECK (owner_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS routines_delete_own ON routines';
EXECUTE 'CREATE POLICY routines_delete_own ON routines FOR DELETE TO authenticated
           USING (owner_id = public.current_user_id())';

-- routine_days y routine_exercises: cuelgan de la rutina.
EXECUTE 'DROP POLICY IF EXISTS routine_days_select_own ON routine_days';
EXECUTE 'CREATE POLICY routine_days_select_own ON routine_days FOR SELECT TO authenticated
           USING (routine_id IN (SELECT id FROM routines
                  WHERE owner_id = public.current_user_id() OR author_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_days_insert_own ON routine_days';
EXECUTE 'CREATE POLICY routine_days_insert_own ON routine_days FOR INSERT TO authenticated
           WITH CHECK (routine_id IN (SELECT id FROM routines WHERE owner_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_days_update_own ON routine_days';
EXECUTE 'CREATE POLICY routine_days_update_own ON routine_days FOR UPDATE TO authenticated
           USING (routine_id IN (SELECT id FROM routines WHERE owner_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_days_delete_own ON routine_days';
EXECUTE 'CREATE POLICY routine_days_delete_own ON routine_days FOR DELETE TO authenticated
           USING (routine_id IN (SELECT id FROM routines WHERE owner_id = public.current_user_id()))';

EXECUTE 'DROP POLICY IF EXISTS routine_exercises_select_own ON routine_exercises';
EXECUTE 'CREATE POLICY routine_exercises_select_own ON routine_exercises FOR SELECT TO authenticated
           USING (routine_day_id IN (SELECT d.id FROM routine_days d JOIN routines r ON r.id = d.routine_id
                  WHERE r.owner_id = public.current_user_id() OR r.author_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_exercises_insert_own ON routine_exercises';
EXECUTE 'CREATE POLICY routine_exercises_insert_own ON routine_exercises FOR INSERT TO authenticated
           WITH CHECK (routine_day_id IN (SELECT d.id FROM routine_days d JOIN routines r ON r.id = d.routine_id
                       WHERE r.owner_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_exercises_update_own ON routine_exercises';
EXECUTE 'CREATE POLICY routine_exercises_update_own ON routine_exercises FOR UPDATE TO authenticated
           USING (routine_day_id IN (SELECT d.id FROM routine_days d JOIN routines r ON r.id = d.routine_id
                  WHERE r.owner_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_exercises_delete_own ON routine_exercises';
EXECUTE 'CREATE POLICY routine_exercises_delete_own ON routine_exercises FOR DELETE TO authenticated
           USING (routine_day_id IN (SELECT d.id FROM routine_days d JOIN routines r ON r.id = d.routine_id
                  WHERE r.owner_id = public.current_user_id()))';

-- assignments: como alumno se lee, como entrenador se escribe.
EXECUTE 'DROP POLICY IF EXISTS assignments_select_own ON assignments';
EXECUTE 'CREATE POLICY assignments_select_own ON assignments FOR SELECT TO authenticated
           USING (client_id = public.current_user_id() OR coach_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS assignments_insert_coach ON assignments';
EXECUTE 'CREATE POLICY assignments_insert_coach ON assignments FOR INSERT TO authenticated
           WITH CHECK (coach_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS assignments_update_coach ON assignments';
EXECUTE 'CREATE POLICY assignments_update_coach ON assignments FOR UPDATE TO authenticated
           USING (coach_id = public.current_user_id())
           WITH CHECK (coach_id = public.current_user_id())';

-- workout_sessions y set_logs: solo lo propio. El historial no se comparte ni
-- con el entrenador por esta puerta.
EXECUTE 'DROP POLICY IF EXISTS workout_sessions_select_own ON workout_sessions';
EXECUTE 'CREATE POLICY workout_sessions_select_own ON workout_sessions FOR SELECT TO authenticated
           USING (user_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS workout_sessions_insert_own ON workout_sessions';
EXECUTE 'CREATE POLICY workout_sessions_insert_own ON workout_sessions FOR INSERT TO authenticated
           WITH CHECK (user_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS workout_sessions_update_own ON workout_sessions';
EXECUTE 'CREATE POLICY workout_sessions_update_own ON workout_sessions FOR UPDATE TO authenticated
           USING (user_id = public.current_user_id())
           WITH CHECK (user_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS workout_sessions_delete_own ON workout_sessions';
EXECUTE 'CREATE POLICY workout_sessions_delete_own ON workout_sessions FOR DELETE TO authenticated
           USING (user_id = public.current_user_id())';

EXECUTE 'DROP POLICY IF EXISTS set_logs_select_own ON set_logs';
EXECUTE 'CREATE POLICY set_logs_select_own ON set_logs FOR SELECT TO authenticated
           USING (session_id IN (SELECT id FROM workout_sessions WHERE user_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS set_logs_insert_own ON set_logs';
EXECUTE 'CREATE POLICY set_logs_insert_own ON set_logs FOR INSERT TO authenticated
           WITH CHECK (session_id IN (SELECT id FROM workout_sessions WHERE user_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS set_logs_update_own ON set_logs';
EXECUTE 'CREATE POLICY set_logs_update_own ON set_logs FOR UPDATE TO authenticated
           USING (session_id IN (SELECT id FROM workout_sessions WHERE user_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS set_logs_delete_own ON set_logs';
EXECUTE 'CREATE POLICY set_logs_delete_own ON set_logs FOR DELETE TO authenticated
           USING (session_id IN (SELECT id FROM workout_sessions WHERE user_id = public.current_user_id()))';

-- personal_records: solo lectura. Las marcas las escribe registrar_prs(), que
-- corre como SECURITY DEFINER al cerrar la sesión.
EXECUTE 'DROP POLICY IF EXISTS personal_records_select_own ON personal_records';
EXECUTE 'CREATE POLICY personal_records_select_own ON personal_records FOR SELECT TO authenticated
           USING (user_id = public.current_user_id())';

END $$;
