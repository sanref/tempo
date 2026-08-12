-- ═══════════════════════════════════════════════════════════════════════════
-- 02 — Trabajo por tiempo
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/02_trabajo_por_tiempo.sql
--   (o `npm run db:migrate`, que corre todos los 0N_ en orden)
--
-- Lleva una base ya creada al esquema de 01_schema.sql. En una base nueva
-- 01_schema.sql ya trae todo esto, así que correrlo es un no-op.
--
-- Es idempotente a propósito: se puede correr dos veces sin romper nada, que
-- es lo que uno acaba haciendo cuando no recuerda si ya lo había pasado.
--
-- Qué resuelve:
--
--   Una plancha no son repeticiones. Antes, '45 s' en `routine_exercises.reps`
--   se convertía en "45 repeticiones" al empezar la sesión, y un rango como
--   '8-12' se convertía en 812 — que además viola el CHECK de set_logs.reps y
--   tumbaba el arranque del entrenamiento.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO tempo, public;

BEGIN;

-- ── Tipo ───────────────────────────────────────────────────────────────────

DO $$
BEGIN
  CREATE TYPE effort_kind AS ENUM ('reps', 'tiempo');
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'effort_kind ya existe, se deja como está.';
END $$;

-- ── Columnas ───────────────────────────────────────────────────────────────

ALTER TABLE routine_exercises
  ADD COLUMN IF NOT EXISTS tipo effort_kind NOT NULL DEFAULT 'reps';

ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS segundos smallint;

-- Los CHECK no admiten IF NOT EXISTS: se tiran y se vuelven a poner.
ALTER TABLE set_logs DROP CONSTRAINT IF EXISTS set_logs_segundos_check;
ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_segundos_check
  CHECK (segundos IS NULL OR segundos BETWEEN 0 AND 3600);

-- ── Traducción del texto del plan ──────────────────────────────────────────
-- El mismo criterio está replicado en src/lib/format.ts para el arranque desde
-- la app. Si tocás uno, tocá el otro.

-- '8' → 8 · '8-12' → 8 · '' → 10.
CREATE OR REPLACE FUNCTION reps_planificadas(p_reps text) RETURNS smallint
LANGUAGE sql IMMUTABLE AS $$
  SELECT least(100, greatest(0,
    coalesce((regexp_match(coalesce(p_reps, ''), '\d+'))[1]::int, 10)
  ))::smallint;
$$;

-- '45 s' → 45 · '1 min' → 60 · '' → 30.
CREATE OR REPLACE FUNCTION segundos_planificados(p_reps text) RETURNS smallint
LANGUAGE sql IMMUTABLE AS $$
  SELECT least(3600, greatest(0,
    coalesce((regexp_match(coalesce(p_reps, ''), '\d+'))[1]::int, 30)
    * CASE WHEN coalesce(p_reps, '') ~* 'min' THEN 60 ELSE 1 END
  ))::smallint;
$$;

-- ── Datos existentes ───────────────────────────────────────────────────────
-- Hasta ahora el trabajo por tiempo solo se distinguía por cómo estaba escrito
-- el campo `reps`. Se marca lo que lo parezca: un número seguido de s / seg /
-- min, sin nada más. '12' o '8-12' no entran.

UPDATE routine_exercises
   SET tipo = 'tiempo'
 WHERE tipo = 'reps'
   AND reps ~* '^\s*\d+\s*(s|seg|segs|segundos|min|mins|minutos)\s*$';

-- Y sus series ya registradas, que hoy guardan repeticiones inventadas. El
-- volumen (kg * reps) se recalcula solo al pasar reps a 0: es una columna
-- generada por la base.
UPDATE set_logs l
   SET segundos = coalesce(nullif(l.reps, 0), segundos_planificados(re.reps)),
       reps     = 0
  FROM routine_exercises re
 WHERE re.id = l.routine_exercise_id
   AND re.tipo = 'tiempo'
   AND l.segundos IS NULL;

-- El CHECK que hace excluyentes reps y segundos va al final, cuando los datos
-- ya cumplen: puesto antes, el UPDATE de arriba no podría ni empezar.
ALTER TABLE set_logs DROP CONSTRAINT IF EXISTS set_logs_reps_o_tiempo;
ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_reps_o_tiempo
  CHECK (segundos IS NULL OR reps = 0);

-- Las marcas personales de esos ejercicios dejan de tener sentido: se
-- calcularon con repeticiones que nunca existieron. `registrar_prs()` ya
-- excluye el trabajo por tiempo, así que no vuelven a aparecer.
DELETE FROM personal_records p
 USING exercises e
 WHERE e.id = p.exercise_id
   AND EXISTS (
     SELECT 1 FROM routine_exercises re
      WHERE re.exercise_id = e.id AND re.tipo = 'tiempo'
   );

COMMIT;

-- Comprobación rápida.
SELECT
  (SELECT count(*) FROM routine_exercises WHERE tipo = 'tiempo')     AS bloques_por_tiempo,
  (SELECT count(*) FROM set_logs WHERE segundos IS NOT NULL)         AS series_por_tiempo,
  (SELECT coalesce(sum(volumen_kg), 0) FROM set_logs
    WHERE segundos IS NOT NULL)                                      AS volumen_por_tiempo;
