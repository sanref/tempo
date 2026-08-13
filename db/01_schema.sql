-- ═══════════════════════════════════════════════════════════════════════════
-- Tempo — esquema de base de datos (PostgreSQL 14+)
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/01_schema.sql
--
-- Todo vive en `public`, que es donde Supabase espera encontrarlo: el SQL
-- editor, PostgREST y las herramientas del panel miran ahí. No se crea ningún
-- schema propio — el `SET search_path` de abajo solo fija dónde aterrizan los
-- objetos si alguien corre esto con otro search_path por defecto.
--
-- Convenciones:
--   · ids uuid con gen_random_uuid() (core desde PG13, sin extensiones)
--   · timestamptz siempre, nunca timestamp desnudo
--   · cargas en numeric(6,2) — kg con un decimal, sin errores de float
--   · borrado en cascada hacia abajo del árbol rutina → día → ejercicio
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

-- ── Tipos ──────────────────────────────────────────────────────────────────

CREATE TYPE user_role        AS ENUM ('alumno', 'entrenador', 'admin');
-- El orden del enum es el orden de los chips de filtro en /ejercicios y de los
-- radios del alta: `getGrupos()` lee `enum_range()`. Los nuevos van al final.
CREATE TYPE muscle_group     AS ENUM ('Pecho', 'Espalda', 'Pierna', 'Hombro', 'Brazo', 'Core',
                                      'Trapecio', 'Antebrazo');
CREATE TYPE routine_level    AS ENUM ('Principiante', 'Intermedio', 'Avanzado', 'Todos');
CREATE TYPE routine_status   AS ENUM ('activa', 'guardada', 'borrador', 'plantilla');
CREATE TYPE progression_kind AS ENUM ('lineal', 'doble', 'manual');
CREATE TYPE session_status   AS ENUM ('en_curso', 'terminada', 'abandonada');
-- Una plancha no son repeticiones. Marcarlo en vez de deducirlo del texto de
-- `reps` evita que la app tenga que adivinar qué significa '45 s'.
CREATE TYPE effort_kind      AS ENUM ('reps', 'tiempo');

-- ── Usuarios ───────────────────────────────────────────────────────────────
-- Sin columnas de credenciales: la autenticación se resuelve fuera (Better
-- Auth / Supabase) y aquí solo vive el perfil. Cuando se enchufe el proveedor,
-- añadir `auth_id text UNIQUE` apuntando a su tabla de identidades.

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  role        user_role NOT NULL DEFAULT 'alumno',
  coach_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  avatar_url  text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_coach_no_self CHECK (coach_id IS DISTINCT FROM id)
);

CREATE INDEX users_coach_id_idx ON users (coach_id) WHERE coach_id IS NOT NULL;

-- ── Catálogo de ejercicios ─────────────────────────────────────────────────
-- Catálogo separado desde el día uno: sin esto no hay forma de responder
-- "¿cómo progresé en press banca?" a través de rutinas distintas.

CREATE TABLE exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  grupo        muscle_group NOT NULL,
  equipo       text NOT NULL,
  imagen_url   text,                     -- NULL ⇒ la UI pinta "Imagen pendiente"
  es_publico   boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Nombre único dentro del catálogo público; los privados se distinguen por dueño.
CREATE UNIQUE INDEX exercises_nombre_publico_key
  ON exercises (lower(nombre)) WHERE es_publico;
CREATE INDEX exercises_grupo_idx ON exercises (grupo);

-- Normalización para buscar sin acentos ni mayúsculas. Se hace con translate()
-- en vez de la extensión `unaccent` para no depender de que esté instalada.
CREATE FUNCTION unaccent_ci(t text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT lower(translate(t,
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'));
$$;

CREATE INDEX exercises_busqueda_idx ON exercises (unaccent_ci(nombre) text_pattern_ops);

-- ── Rutinas ────────────────────────────────────────────────────────────────

CREATE TABLE routines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  descripcion  text NOT NULL DEFAULT '',
  nivel        routine_level NOT NULL DEFAULT 'Intermedio',
  semanas      integer NOT NULL DEFAULT 8 CHECK (semanas BETWEEN 1 AND 104),
  status       routine_status NOT NULL DEFAULT 'borrador',
  owner_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_id    uuid REFERENCES users (id) ON DELETE SET NULL,  -- entrenador que la escribió
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX routines_owner_idx ON routines (owner_id, status);

CREATE TABLE routine_days (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id        uuid NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
  orden             smallint NOT NULL CHECK (orden >= 0),
  codigo            text NOT NULL,               -- 'A', 'B', …  → pestaña "A · Tirón"
  nombre            text NOT NULL,               -- 'Tirón'
  titulo            text NOT NULL,               -- 'Día A — Tirón'
  subtitulo         text NOT NULL DEFAULT '',
  duracion_min      smallint,
  descanso_defecto_s smallint NOT NULL DEFAULT 90 CHECK (descanso_defecto_s BETWEEN 0 AND 600),
  progresion        progression_kind NOT NULL DEFAULT 'lineal',
  incremento_kg     numeric(4,2) NOT NULL DEFAULT 2.5,
  notas             text NOT NULL DEFAULT '',
  UNIQUE (routine_id, orden),
  UNIQUE (routine_id, codigo)
);

CREATE TABLE routine_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_day_id  uuid NOT NULL REFERENCES routine_days (id) ON DELETE CASCADE,
  exercise_id     uuid NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
  orden           smallint NOT NULL CHECK (orden >= 0),
  series          smallint NOT NULL DEFAULT 3 CHECK (series BETWEEN 1 AND 8),
  tipo            effort_kind NOT NULL DEFAULT 'reps',
  reps            text NOT NULL DEFAULT '10',      -- texto: admite '8', '8-12', '45 s'
  carga_kg        numeric(6,2) CHECK (carga_kg IS NULL OR carga_kg >= 0),
  carga_texto     text,                            -- 'Peso corp.', '+17,5 kg' cuando no hay número
  descanso_s      smallint CHECK (descanso_s IS NULL OR descanso_s BETWEEN 0 AND 600),
  notas           text NOT NULL DEFAULT '',
  UNIQUE (routine_day_id, orden)
);

CREATE INDEX routine_exercises_exercise_idx ON routine_exercises (exercise_id);

-- `reps` es texto libre del plan y hay que traducirlo a un número al arrancar
-- la sesión. Estas dos funciones fijan la regla en un solo sitio; el mismo
-- criterio está replicado en src/app/actions.ts para el arranque desde la app.

-- '8' → 8 · '8-12' → 8 · '' → 10.
-- Un rango se resuelve por el extremo bajo: es lo que la mayoría registra y
-- deja margen para subir. Un `regexp_replace` de todo lo que no sea dígito
-- convertiría '8-12' en 812, que además viola el CHECK de set_logs.reps.
CREATE FUNCTION reps_planificadas(p_reps text) RETURNS smallint
LANGUAGE sql IMMUTABLE AS $$
  SELECT least(100, greatest(0,
    coalesce((regexp_match(coalesce(p_reps, ''), '\d+'))[1]::int, 10)
  ))::smallint;
$$;

-- '45 s' → 45 · '1 min' → 60 · '' → 30. Solo para bloques de tipo 'tiempo'.
CREATE FUNCTION segundos_planificados(p_reps text) RETURNS smallint
LANGUAGE sql IMMUTABLE AS $$
  SELECT least(3600, greatest(0,
    coalesce((regexp_match(coalesce(p_reps, ''), '\d+'))[1]::int, 30)
    * CASE WHEN coalesce(p_reps, '') ~* 'min' THEN 60 ELSE 1 END
  ))::smallint;
$$;

-- ── Asignaciones entrenador → alumno ───────────────────────────────────────

CREATE TABLE assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id  uuid NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
  coach_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  started_on  date NOT NULL DEFAULT current_date,
  ended_on    date,
  notas       text NOT NULL DEFAULT '',
  CONSTRAINT assignments_rango CHECK (ended_on IS NULL OR ended_on >= started_on)
);

-- Un alumno solo puede tener una asignación viva de la misma rutina.
CREATE UNIQUE INDEX assignments_activa_key
  ON assignments (client_id, routine_id) WHERE ended_on IS NULL;
CREATE INDEX assignments_coach_idx ON assignments (coach_id) WHERE ended_on IS NULL;

-- ── Sesiones de entrenamiento ──────────────────────────────────────────────

CREATE TABLE workout_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  routine_id      uuid REFERENCES routines (id) ON DELETE SET NULL,
  routine_day_id  uuid REFERENCES routine_days (id) ON DELETE SET NULL,
  titulo          text NOT NULL,        -- desnormalizado: la rutina puede cambiar después
  status          session_status NOT NULL DEFAULT 'en_curso',
  -- El cronómetro se calcula como now() - started_at. Nunca acumular ticks del
  -- cliente: la pestaña se cierra en mitad de la serie y el tiempo se pierde.
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  notas           text NOT NULL DEFAULT '',
  CONSTRAINT sessions_rango CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX sessions_user_fecha_idx ON workout_sessions (user_id, started_at DESC);

-- Una sola sesión en curso por usuario: el botón "Empezar" debe reanudar, no duplicar.
CREATE UNIQUE INDEX sessions_una_en_curso_key
  ON workout_sessions (user_id) WHERE status = 'en_curso';

-- ── Registro de series ─────────────────────────────────────────────────────
-- La tabla que más crece. `done_at IS NULL` = serie planificada pero no
-- confirmada; solo las confirmadas cuentan para volumen, progreso y PRs.

CREATE TABLE set_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
  exercise_id         uuid NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
  routine_exercise_id uuid REFERENCES routine_exercises (id) ON DELETE SET NULL,
  bloque              smallint NOT NULL CHECK (bloque >= 0),  -- posición del ejercicio en la sesión
  orden               smallint NOT NULL CHECK (orden >= 1),   -- nº de serie dentro del ejercicio
  kg                  numeric(6,2) NOT NULL DEFAULT 0 CHECK (kg >= 0),
  reps                smallint NOT NULL DEFAULT 0 CHECK (reps BETWEEN 0 AND 100),
  -- Trabajo por tiempo (planchas, isométricos). Excluyente con reps: si hay
  -- segundos, reps se queda en 0 y la serie no aporta volumen ni compite por
  -- marca. Inventarle repeticiones a una plancha ensucia todas las métricas.
  segundos            smallint CHECK (segundos IS NULL OR segundos BETWEEN 0 AND 3600),
  done_at             timestamptz,
  UNIQUE (session_id, bloque, orden),
  CONSTRAINT set_logs_reps_o_tiempo CHECK (segundos IS NULL OR reps = 0)
);

CREATE INDEX set_logs_session_idx  ON set_logs (session_id);
-- Sirve a la columna "Anterior" y a las curvas de progreso.
CREATE INDEX set_logs_ejercicio_idx ON set_logs (exercise_id, done_at DESC) WHERE done_at IS NOT NULL;

-- Volumen de la serie, calculado por la base para no repetir kg*reps en cada query.
-- El trabajo por tiempo lleva reps = 0, así que aporta 0 al volumen — que es lo
-- correcto: una plancha no son kilos levantados y sumarla falsearía la curva.
ALTER TABLE set_logs
  ADD COLUMN volumen_kg numeric(9,2) GENERATED ALWAYS AS (kg * reps) STORED;

-- ── Marcas personales ──────────────────────────────────────────────────────
-- Se recalculan al cerrar la sesión (ver `tempo.registrar_prs`).

CREATE TABLE personal_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
  session_id   uuid REFERENCES workout_sessions (id) ON DELETE SET NULL,
  kg           numeric(6,2) NOT NULL CHECK (kg >= 0),
  reps         smallint NOT NULL CHECK (reps >= 1),
  e1rm_kg      numeric(6,2) NOT NULL,   -- Epley: kg * (1 + reps/30)
  delta_kg     numeric(6,2) NOT NULL DEFAULT 0,
  achieved_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prs_user_idx ON personal_records (user_id, achieved_at DESC);
CREATE INDEX prs_user_ejercicio_idx ON personal_records (user_id, exercise_id, achieved_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vistas y funciones de apoyo
-- ═══════════════════════════════════════════════════════════════════════════

-- Resumen por sesión: alimenta Historial sin recorrer set_logs desde la app.
CREATE VIEW session_summaries AS
SELECT
  s.id,
  s.user_id,
  s.titulo,
  s.started_at,
  s.ended_at,
  s.status,
  count(l.id) FILTER (WHERE l.done_at IS NOT NULL)          AS series,
  coalesce(sum(l.volumen_kg) FILTER (WHERE l.done_at IS NOT NULL), 0) AS volumen_kg,
  EXTRACT(EPOCH FROM (coalesce(s.ended_at, now()) - s.started_at))::int AS duracion_s,
  EXISTS (SELECT 1 FROM personal_records pr WHERE pr.session_id = s.id) AS tuvo_pr
FROM workout_sessions s
LEFT JOIN set_logs l ON l.session_id = s.id
GROUP BY s.id;

-- Volumen semanal de las últimas 12 semanas — el gráfico de barras de Inicio.
CREATE FUNCTION volumen_semanal(p_user uuid, p_semanas int DEFAULT 12)
RETURNS TABLE (semana date, volumen_kg numeric)
LANGUAGE sql STABLE AS $$
  WITH semanas AS (
    SELECT generate_series(
      date_trunc('week', now()) - make_interval(weeks => p_semanas - 1),
      date_trunc('week', now()),
      '1 week'
    )::date AS semana
  )
  SELECT w.semana,
         coalesce(sum(l.volumen_kg), 0)::numeric AS volumen_kg
  FROM semanas w
  LEFT JOIN workout_sessions s
    ON s.user_id = p_user
   AND date_trunc('week', s.started_at)::date = w.semana
  LEFT JOIN set_logs l
    ON l.session_id = s.id AND l.done_at IS NOT NULL
  GROUP BY w.semana
  ORDER BY w.semana;
$$;

-- Última carga registrada por ejercicio y número de serie → columna "Anterior".
CREATE FUNCTION ultimas_series(p_user uuid, p_exercise uuid)
RETURNS TABLE (orden smallint, kg numeric, reps smallint)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (l.orden) l.orden, l.kg, l.reps
  FROM set_logs l
  JOIN workout_sessions s ON s.id = l.session_id
  WHERE s.user_id = p_user
    AND l.exercise_id = p_exercise
    AND l.done_at IS NOT NULL
  ORDER BY l.orden, l.done_at DESC;
$$;

-- Adherencia = sesiones hechas / sesiones planificadas en la ventana dada.
CREATE FUNCTION adherencia(p_user uuid, p_dias int DEFAULT 28)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  WITH plan AS (
    SELECT coalesce(max(d.cnt), 0) AS dias_semana
    FROM (
      SELECT count(*) AS cnt
      FROM assignments a
      JOIN routine_days rd ON rd.routine_id = a.routine_id
      WHERE a.client_id = p_user AND a.ended_on IS NULL
      GROUP BY a.id
    ) d
  ),
  hechas AS (
    SELECT count(*)::numeric AS n
    FROM workout_sessions s
    WHERE s.user_id = p_user
      AND s.status = 'terminada'
      AND s.started_at >= now() - make_interval(days => p_dias)
  )
  SELECT CASE
    WHEN (SELECT dias_semana FROM plan) = 0 THEN 0
    ELSE least(100, round(
      (SELECT n FROM hechas) * 100
      / ((SELECT dias_semana FROM plan) * (p_dias / 7.0)), 0))
  END;
$$;

-- Registra los PRs de una sesión recién cerrada y devuelve cuántos hubo.
-- Criterio: e1RM (Epley) superior a cualquier marca previa del mismo ejercicio.
CREATE FUNCTION registrar_prs(p_session uuid)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_user uuid;
  v_at   timestamptz;
  v_n    integer := 0;
BEGIN
  SELECT user_id, coalesce(ended_at, now()) INTO v_user, v_at
  FROM workout_sessions WHERE id = p_session;
  IF v_user IS NULL THEN RETURN 0; END IF;

  WITH mejores AS (
    SELECT DISTINCT ON (l.exercise_id)
      l.exercise_id,
      l.kg,
      l.reps,
      round(l.kg * (1 + l.reps / 30.0), 2) AS e1rm
    FROM set_logs l
    -- Epley deja de tener sentido pasadas ~30 reps, y por encima de eso lo que
    -- hay suele ser trabajo por tiempo (planchas): no compite por marca.
    WHERE l.session_id = p_session AND l.done_at IS NOT NULL AND l.reps BETWEEN 1 AND 30
    ORDER BY l.exercise_id, (l.kg * (1 + l.reps / 30.0)) DESC
  ),
  previos AS (
    SELECT m.*, coalesce((
      SELECT max(pr.e1rm_kg) FROM personal_records pr
      WHERE pr.user_id = v_user AND pr.exercise_id = m.exercise_id
    ), 0) AS anterior
    FROM mejores m
  ),
  insertados AS (
    INSERT INTO personal_records (user_id, exercise_id, session_id, kg, reps, e1rm_kg, delta_kg, achieved_at)
    SELECT v_user, p.exercise_id, p_session, p.kg, p.reps, p.e1rm, p.e1rm - p.anterior, v_at
    FROM previos p
    WHERE p.e1rm > p.anterior
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM insertados;

  RETURN v_n;
END;
$$;

-- updated_at automático en rutinas.
CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER routines_touch
  BEFORE UPDATE ON routines
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════
-- En Supabase, `public` es el schema que publica PostgREST: cualquiera con la
-- clave anónima —que viaja en el navegador— puede leer y escribir sus tablas.
-- Vivir en un schema aparte tapaba eso sin querer; aquí hay que decirlo.
--
-- RLS activada y sin políticas = nadie pasa por esa puerta. La app no se
-- entera: entra por DATABASE_URL con el rol dueño de las tablas, y el dueño
-- salta RLS mientras no se use FORCE ROW LEVEL SECURITY. Cuando haya auth de
-- verdad (users.auth_id), las políticas por usuario van justo aquí.

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_days      ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records  ENABLE ROW LEVEL SECURITY;

-- Una vista consulta con los permisos de su dueño salvo que se diga lo
-- contrario: sin esto, session_summaries enseñaría set_logs esquivando las RLS
-- de arriba. `security_invoker` es de PG15+; en PG14 la vista se queda como
-- está y la protección la da el GRANT.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    EXECUTE 'ALTER VIEW session_summaries SET (security_invoker = on)';
  ELSE
    RAISE NOTICE 'PG14: session_summaries se queda sin security_invoker.';
  END IF;
END $$;
