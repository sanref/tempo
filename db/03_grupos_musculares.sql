-- ═══════════════════════════════════════════════════════════════════════════
-- 03 — Trapecio y Antebrazo
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/03_grupos_musculares.sql
--   (o `npm run db:migrate`, que corre todos los 0N_ en orden)
--
-- Lleva una base ya creada al esquema de 01_schema.sql. En una base nueva
-- 01_schema.sql ya trae los dos valores, así que correrlo es un no-op.
--
-- Es idempotente: `ADD VALUE IF NOT EXISTS` no se queja si ya está.
--
-- Qué resuelve:
--
--   El catálogo traía encogimientos y trabajo de antebrazo, y no había dónde
--   ponerlos: `muscle_group` solo tenía seis valores. Al final del enum, que es
--   el orden en que salen los chips de /ejercicios y los radios del alta —
--   `getGrupos()` lee `enum_range()`, así que aparecen solos, sin tocar la UI.
--
-- Sin BEGIN/COMMIT a propósito: `ALTER TYPE … ADD VALUE` no puede usarse en la
-- misma transacción que lo añade, y aquí cada sentencia va por su cuenta.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

ALTER TYPE muscle_group ADD VALUE IF NOT EXISTS 'Trapecio';
ALTER TYPE muscle_group ADD VALUE IF NOT EXISTS 'Antebrazo';

-- Comprobación rápida.
SELECT string_agg(v::text, ' · ' ORDER BY v) AS grupos
  FROM unnest(enum_range(NULL::muscle_group)) v;
