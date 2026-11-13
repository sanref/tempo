-- ═══════════════════════════════════════════════════════════════════════════
-- 13 — Descripción de los ejercicios
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/13_descripcion_ejercicios.sql
--
-- Texto libre para contar cómo se hace el movimiento. Vive en `exercises` y no
-- en una tabla por persona como los alias: es de la fila, la escribe quien
-- puede editar el ejercicio (`ejercicioEditable()`: lo suyo y privado, o un
-- admin) y la lee todo el que lo ve.
--
-- NOT NULL con '' por defecto, igual que `routines.descripcion`: así nadie
-- tiene que distinguir NULL de vacío al pintar.
--
-- Sin política de RLS nueva: las de `exercises` cubren la fila entera, sin
-- lista de columnas. El móvil no la escribe ni la lee todavía; la columna
-- nueva no le cambia nada.
--
-- Idempotente: se puede correr dos veces seguidas.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS descripcion text NOT NULL DEFAULT '';
