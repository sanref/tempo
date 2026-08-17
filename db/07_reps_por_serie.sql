-- ═══════════════════════════════════════════════════════════════════════════
-- 07 — Repeticiones distintas por serie
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/07_reps_por_serie.sql
--
-- Hasta aquí `routine_exercises.reps` describía TODAS las series del bloque con
-- un solo valor: 4×10 eran cuatro series de diez. No había forma de pedir una
-- pirámide (15, 12, 10, 10), que es de lo más común en un plan.
--
-- Ahora la barra separa series:
--
--   '10'            → todas las series a 10          (igual que antes)
--   '8-12'          → rango, todas las series        (igual que antes)
--   '15/12/10/10'   → 15, 12, 10 y 10                ← nuevo
--   '12-15/10-12/8' → un rango por serie             (sale gratis)
--   '45 s/30 s'     → por tiempo                     ← nuevo
--
-- **La barra y no el guion**: '8-12' ya significaba un rango, y es lo que lee
-- la progresión doble. Si el guion separase series, '8-12' sería ambiguo —
-- ¿un rango de 8 a 12, o dos series de 8 y de 12?
--
-- Si hay menos tramos que series, se repite el último: 5 series con '15/12/10'
-- son 15, 12, 10, 10 y 10.
--
-- Las dos funciones ganan un parámetro `p_serie` (base 0) con valor por
-- defecto, así que las llamadas de un solo argumento que ya existen —el seed—
-- siguen valiendo y devuelven el primer tramo, como antes.
--
-- El mismo criterio está en src/lib/format.ts (`repsPlanificadas`,
-- `segundosPlanificados`, `tramosReps`). Si tocás uno, tocá el otro.
--
-- Idempotente: se puede correr dos veces seguidas.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

-- Se dropean antes de crear: añadir un parámetro con DEFAULT no reemplaza la
-- función de un argumento, la sobrecarga, y entonces `reps_planificadas(x)`
-- queda ambigua y falla.
DROP FUNCTION IF EXISTS reps_planificadas(text);
DROP FUNCTION IF EXISTS segundos_planificados(text);
DROP FUNCTION IF EXISTS reps_planificadas(text, int);
DROP FUNCTION IF EXISTS segundos_planificados(text, int);

/* El tramo que le toca a una serie. Los arrays de Postgres empiezan en 1 y
   `p_serie` viene en base 0, de ahí el +1. Un texto sin barras da un array de
   un elemento, así que el caso de siempre pasa por el mismo camino.

   `OR REPLACE` y no DROP: su firma no cambia entre pasadas, y las dos de abajo
   la usan en su cuerpo. */
CREATE OR REPLACE FUNCTION tramo_reps(p_reps text, p_serie int DEFAULT 0) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  WITH partes AS (
    SELECT array(
      SELECT btrim(x)
      FROM unnest(string_to_array(coalesce(p_reps, ''), '/')) AS x
      WHERE btrim(x) <> ''
    ) AS t
  )
  SELECT CASE
           WHEN cardinality(t) = 0 THEN coalesce(p_reps, '')
           ELSE t[least(greatest(coalesce(p_serie, 0), 0), cardinality(t) - 1) + 1]
         END
  FROM partes;
$$;

CREATE FUNCTION reps_planificadas(p_reps text, p_serie int DEFAULT 0) RETURNS smallint
LANGUAGE sql IMMUTABLE AS $$
  SELECT least(100, greatest(0,
    coalesce((regexp_match(tramo_reps(p_reps, p_serie), '\d+'))[1]::int, 10)
  ))::smallint;
$$;

CREATE FUNCTION segundos_planificados(p_reps text, p_serie int DEFAULT 0) RETURNS smallint
LANGUAGE sql IMMUTABLE AS $$
  SELECT least(3600, greatest(0,
    coalesce((regexp_match(tramo_reps(p_reps, p_serie), '\d+'))[1]::int, 30)
    * CASE WHEN tramo_reps(p_reps, p_serie) ~* 'min' THEN 60 ELSE 1 END
  ))::smallint;
$$;
