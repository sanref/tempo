-- ═══════════════════════════════════════════════════════════════════════════
-- 06 — Plan propio: un alumno puede activar su rutina sin entrenador
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/06_plan_propio.sql
--
-- Hasta aquí una asignación exigía entrenador (`coach_id NOT NULL`), y como
-- `asignarRutina()` pide rol de entrenador, un alumno suelto podía crear una
-- rutina pero no convertirla en *su plan*: `getPlanActivo()` lee de
-- `assignments`, así que /entrenar y la home le salían vacías aunque tuviera
-- la rutina hecha. Entrenarla solo se podía desde /rutinas/[id].
--
-- A partir de ahora `coach_id` admite NULL y eso significa exactamente una
-- cosa: **el alumno se lo asignó él**. Sigue habiendo una sola fuente de verdad
-- para "cuál es mi plan" — `assignments` — que es lo que mantiene coherentes la
-- adherencia, el próximo día y la progresión.
--
-- Idempotente: se puede correr dos veces seguidas.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

-- ── 1. El entrenador pasa a ser opcional ──────────────────────────────────

ALTER TABLE assignments ALTER COLUMN coach_id DROP NOT NULL;

-- Un plan propio se marca con NULL, no poniéndose uno mismo de entrenador: si
-- se admitieran las dos formas, `getPlanActivo()` tendría que distinguirlas y
-- la mitad de las consultas del panel de entrenador contarían a gente como
-- alumna de sí misma.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assignments_coach_no_self'
  ) THEN
    ALTER TABLE assignments
      ADD CONSTRAINT assignments_coach_no_self
      CHECK (coach_id IS DISTINCT FROM client_id);
  END IF;
END $$;

-- ── 2. Políticas ──────────────────────────────────────────────────────────
-- La de INSERT solo dejaba escribir con uno mismo de entrenador; ahora también
-- vale asignarse una rutina a uno mismo, que es la fila con `coach_id IS NULL`.

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
  RAISE NOTICE 'Sin schema `auth` (Postgres local): me salto las políticas.';
  RETURN;
END IF;

EXECUTE 'DROP POLICY IF EXISTS assignments_insert_coach ON assignments';
EXECUTE 'CREATE POLICY assignments_insert_coach ON assignments FOR INSERT TO authenticated
           WITH CHECK (
             coach_id = public.current_user_id()
             OR (coach_id IS NULL AND client_id = public.current_user_id())
           )';

EXECUTE 'DROP POLICY IF EXISTS assignments_update_coach ON assignments';
EXECUTE 'CREATE POLICY assignments_update_coach ON assignments FOR UPDATE TO authenticated
           USING (
             coach_id = public.current_user_id()
             OR (coach_id IS NULL AND client_id = public.current_user_id())
           )
           WITH CHECK (
             coach_id = public.current_user_id()
             OR (coach_id IS NULL AND client_id = public.current_user_id())
           )';

END $$;
