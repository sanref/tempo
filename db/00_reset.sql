-- Tempo — reset completo del esquema.
-- Destructivo: borra todos los datos. Solo para desarrollo.
--
-- No borra el schema, borra sus objetos. En Supabase `public` viene con
-- permisos y configuración propios (los roles anon/authenticated, los
-- privilegios por defecto de PostgREST); recrearlo deja el proyecto tocado.
-- Por eso se tiran las cosas de Tempo una a una y `public` se queda donde está.

SET search_path TO public;

DROP VIEW IF EXISTS session_summaries;

-- Los índices y los triggers se van con su tabla.
DROP TABLE IF EXISTS personal_records, set_logs, workout_sessions, assignments,
                     routine_exercises, routine_days, routines, exercises, users
  CASCADE;

DROP FUNCTION IF EXISTS registrar_prs(uuid);
DROP FUNCTION IF EXISTS adherencia(uuid, int);
DROP FUNCTION IF EXISTS ultimas_series(uuid, uuid);
DROP FUNCTION IF EXISTS volumen_semanal(uuid, int);
DROP FUNCTION IF EXISTS segundos_planificados(text);
DROP FUNCTION IF EXISTS reps_planificadas(text);
DROP FUNCTION IF EXISTS unaccent_ci(text);
DROP FUNCTION IF EXISTS touch_updated_at();

DROP TYPE IF EXISTS effort_kind, session_status, progression_kind,
                    routine_status, routine_level, muscle_group, user_role;

-- Resto de cuando Tempo vivía en su propio schema. En una base nueva no hace
-- nada; en la de antes, la deja limpia.
DROP SCHEMA IF EXISTS tempo CASCADE;
