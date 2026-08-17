-- Tempo — reset completo del esquema.
-- Destructivo: borra todos los datos. Solo para desarrollo.
--
-- ⚠ La base de Supabase está compartida con tempo_mobile. Correr esto allí no
-- borra solo lo del web: se lleva por delante los datos del móvil, sus
-- políticas RLS y sus RPC (que viven en tempo_mobile/supabase/migrations/ y
-- este archivo no sabe recrear). Las cuentas de auth.users se quedan, pero
-- huérfanas — sin fila en `users` nadie puede entrar hasta volver a
-- registrarse. Resetear contra una base desechable, no contra la compartida.
--
-- No borra el schema, borra sus objetos. En Supabase `public` viene con
-- permisos y configuración propios (los roles anon/authenticated, los
-- privilegios por defecto de PostgREST); recrearlo deja el proyecto tocado.
-- Por eso se tiran las cosas de Tempo una a una y `public` se queda donde está.

SET search_path TO public;

DROP VIEW IF EXISTS session_summaries;

-- Los índices y los triggers se van con su tabla.
DROP TABLE IF EXISTS personal_records, set_logs, workout_sessions, assignments,
                     coach_invites, routine_exercises, routine_days, routines,
                     exercises, users
  CASCADE;

-- El trigger cuelga de auth.users, que no es nuestra: no se va con las tablas
-- de arriba y hay que quitarlo a mano. El DO es porque en un Postgres local el
-- schema `auth` no existe y un DROP a pelo cortaría el script.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
  END IF;
END $$;

DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS current_user_id();
DROP FUNCTION IF EXISTS registrar_prs(uuid);
DROP FUNCTION IF EXISTS adherencia(uuid, int);
DROP FUNCTION IF EXISTS ultimas_series(uuid, uuid);
DROP FUNCTION IF EXISTS volumen_semanal(uuid, int);
DROP FUNCTION IF EXISTS segundos_planificados(text);
DROP FUNCTION IF EXISTS reps_planificadas(text);
DROP FUNCTION IF EXISTS segundos_planificados(text, int);
DROP FUNCTION IF EXISTS reps_planificadas(text, int);
DROP FUNCTION IF EXISTS tramo_reps(text, int);
DROP FUNCTION IF EXISTS unaccent_ci(text);
DROP FUNCTION IF EXISTS touch_updated_at();

DROP TYPE IF EXISTS effort_kind, session_status, progression_kind,
                    routine_status, routine_level, muscle_group, user_role;

-- Resto de cuando Tempo vivía en su propio schema. En una base nueva no hace
-- nada; en la de antes, la deja limpia.
DROP SCHEMA IF EXISTS tempo CASCADE;
