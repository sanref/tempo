-- ═══════════════════════════════════════════════════════════════════════════
-- 11 — Alias de ejercicio por usuario
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/11_alias_ejercicios.sql
--
-- El catálogo tiene un nombre por ejercicio, pero el mismo movimiento se llama
-- distinto en cada gimnasio. Hasta aquí la única forma de que el nombre encajara
-- con el léxico de uno era renombrar la fila — y eso solo lo puede hacer el
-- dueño o un admin, y se lo cambia a todo el mundo.
--
-- Un alias es cómo lo llama UNA persona. Se resuelve
-- `coalesce(el mío, el del autor de la rutina, el del catálogo)`: dentro de una
-- rutina que escribió mi entrenador veo su nombre si yo no puse el mío. El
-- vínculo va por `routines.author_id` y no por `users.coach_id`, así que
-- desvincularse no renombra media app de golpe.
--
-- Es presentación pura: nada resuelve un id por el alias, no entra en
-- `routine_exercises` ni en `set_logs`, y borrarlo devuelve el nombre real.
--
-- Idempotente: se puede correr dos veces seguidas.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

CREATE TABLE IF NOT EXISTS exercise_aliases (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- CASCADE, no RESTRICT: un alias no puede impedir borrar un ejercicio que no
  -- usa nadie. `borrarEjercicio()` solo cuenta rutinas y series registradas.
  exercise_id uuid NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
  alias       text NOT NULL CHECK (length(btrim(alias)) BETWEEN 2 AND 80),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Un alias por persona y ejercicio. La PK es además el índice de los dos
  -- joins de lectura: el mío y el del autor de la rutina.
  PRIMARY KEY (user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS exercise_aliases_exercise_idx ON exercise_aliases (exercise_id);
-- Acompaña a exercises_busqueda_idx: el buscador de /ejercicios mira los dos.
CREATE INDEX IF NOT EXISTS exercise_aliases_busqueda_idx
  ON exercise_aliases (unaccent_ci(alias) text_pattern_ops);

ALTER TABLE exercise_aliases ENABLE ROW LEVEL SECURITY;

-- Políticas. Leer: lo mío, más lo de quien escribió una rutina que tengo
-- asignada y viva — ese segundo caso es el que hace llegar el alias del
-- entrenador al alumno, y es el mismo criterio que aplica el web.
--
-- Escribir: solo lo mío, ni siendo admin. Un admin arregla el catálogo común,
-- que es de todos; un alias es de uno.
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
  RAISE NOTICE 'Sin schema `auth` (Postgres local): me salto las políticas.';
  RETURN;
END IF;

EXECUTE 'DROP POLICY IF EXISTS exercise_aliases_select_visible ON exercise_aliases';
EXECUTE 'CREATE POLICY exercise_aliases_select_visible ON exercise_aliases
           FOR SELECT TO authenticated
           USING (user_id = public.current_user_id()
                  OR EXISTS (SELECT 1 FROM assignments a
                               JOIN routines r ON r.id = a.routine_id
                              WHERE a.client_id = public.current_user_id()
                                AND a.ended_on IS NULL
                                AND r.author_id = exercise_aliases.user_id))';
EXECUTE 'DROP POLICY IF EXISTS exercise_aliases_insert_own ON exercise_aliases';
EXECUTE 'CREATE POLICY exercise_aliases_insert_own ON exercise_aliases
           FOR INSERT TO authenticated
           WITH CHECK (user_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS exercise_aliases_update_own ON exercise_aliases';
EXECUTE 'CREATE POLICY exercise_aliases_update_own ON exercise_aliases
           FOR UPDATE TO authenticated
           USING (user_id = public.current_user_id())
           WITH CHECK (user_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS exercise_aliases_delete_own ON exercise_aliases';
EXECUTE 'CREATE POLICY exercise_aliases_delete_own ON exercise_aliases
           FOR DELETE TO authenticated
           USING (user_id = public.current_user_id())';

END $$;
