-- ═══════════════════════════════════════════════════════════════════════════
-- 05 — Invitaciones de entrenador
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/05_invitaciones.sql
--
-- Hasta aquí `users.coach_id` solo lo escribía el seed: no había forma de que
-- un alumno registrado acabara con entrenador, y `asignarRutina()` —que exige
-- `coach_id = <el entrenador>`— rechazaba a cualquiera que no viniera de ahí.
--
-- El vínculo lo hacen las dos partes: el entrenador genera un código y el
-- alumno lo canjea. Nadie reclama a nadie sin que el otro escriba algo.
--
-- Idempotente: se puede correr dos veces seguidas.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

CREATE TABLE IF NOT EXISTS coach_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sin guiones ni minúsculas: se normaliza al generar y al canjear, para que
  -- dé igual cómo lo teclee quien lo recibe.
  codigo      text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9]{6,16}$'),
  coach_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  used_by     uuid REFERENCES users (id) ON DELETE SET NULL,
  -- Un código usado tiene las dos columnas puestas o ninguna. Sin esto, un
  -- `used_at` suelto dejaría el código quemado sin saber quién lo gastó.
  CONSTRAINT coach_invites_uso_completo CHECK ((used_at IS NULL) = (used_by IS NULL))
);

CREATE INDEX IF NOT EXISTS coach_invites_coach_idx ON coach_invites (coach_id, created_at DESC);

ALTER TABLE coach_invites ENABLE ROW LEVEL SECURITY;

-- Políticas: el entrenador manda sobre sus propios códigos.
--
-- El canje NO tiene política a propósito. Para canjear hay que leer la fila de
-- otro —la del entrenador— y una política que lo permitiera dejaría enumerar
-- códigos ajenos desde el navegador. En el web el canje lo hace una server
-- action, que entra con el rol dueño y salta RLS comprobando ella misma. El día
-- que el móvil lo necesite, va como función SECURITY DEFINER, no como política.
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
  RAISE NOTICE 'Sin schema `auth` (Postgres local): me salto las políticas.';
  RETURN;
END IF;

EXECUTE 'DROP POLICY IF EXISTS coach_invites_select_own ON coach_invites';
EXECUTE 'CREATE POLICY coach_invites_select_own ON coach_invites FOR SELECT TO authenticated
           USING (coach_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS coach_invites_insert_own ON coach_invites';
EXECUTE 'CREATE POLICY coach_invites_insert_own ON coach_invites FOR INSERT TO authenticated
           WITH CHECK (coach_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS coach_invites_delete_own ON coach_invites';
EXECUTE 'CREATE POLICY coach_invites_delete_own ON coach_invites FOR DELETE TO authenticated
           USING (coach_id = public.current_user_id() AND used_at IS NULL)';

END $$;
