-- ═══════════════════════════════════════════════════════════════════════════
-- 12 — Resumen de frecuencia cardíaca por sesión
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/12_frecuencia_cardiaca.sql
--
-- El móvil puede conectar por Bluetooth LE una banda de pecho o un reloj en
-- modo broadcast (servicio estándar Heart Rate, 0x180D) durante el
-- entrenamiento. No se guarda la serie temporal —eso sería una tabla nueva y
-- mucho peso para lo que hace falta hoy—, solo el promedio y la máxima de la
-- sesión, calculados en el cliente a partir de las muestras.
--
-- Sin política de RLS nueva: `workout_sessions_update_own` ya cubre toda la
-- fila, sin lista de columnas, y de todos modos la escritura real es un RPC
-- SECURITY DEFINER (`terminar_sesion_rpc`), que no pasa por RLS.
--
-- Idempotente: se puede correr dos veces seguidas.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS fc_promedio smallint,
  ADD COLUMN IF NOT EXISTS fc_maxima smallint;

ALTER TABLE workout_sessions DROP CONSTRAINT IF EXISTS sessions_fc_rango;
ALTER TABLE workout_sessions ADD CONSTRAINT sessions_fc_rango
  CHECK (fc_maxima IS NULL OR fc_promedio IS NULL OR fc_maxima >= fc_promedio);
