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
-- Sin columnas de credenciales: quien las guarda es Supabase Auth, en su
-- schema `auth`, y aquí solo vive el perfil. `auth_id` es el puente entre los
-- dos: lo rellena el trigger `on_auth_user_created` (ver el final del archivo).
--
-- Sin clave ajena contra auth.users a propósito — `auth` es de Supabase, y
-- atar el esquema a su ciclo de vida hace que este archivo deje de correr en
-- un Postgres pelado.

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  role        user_role NOT NULL DEFAULT 'alumno',
  coach_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  avatar_url  text,
  activo      boolean NOT NULL DEFAULT true,
  auth_id     uuid UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_coach_no_self CHECK (coach_id IS DISTINCT FROM id)
);

CREATE INDEX users_coach_id_idx ON users (coach_id) WHERE coach_id IS NOT NULL;
-- Se busca por aquí en cada petición: es como la sesión se traduce a un perfil.
CREATE INDEX users_auth_id_idx ON users (auth_id);

-- ── Catálogo de ejercicios ─────────────────────────────────────────────────
-- Catálogo separado desde el día uno: sin esto no hay forma de responder
-- "¿cómo progresé en press banca?" a través de rutinas distintas.

-- `grupo` es el grupo grueso que ordena la biblioteca (ocho valores, en
-- español). Los `musculos_*` son otra cosa: el detalle fino que viene del
-- catálogo externo y alimenta el diagrama. Uno no sustituye al otro — 'Brazo'
-- no distingue bíceps de tríceps, y el diagrama sí.
CREATE TABLE exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  grupo        muscle_group NOT NULL,
  equipo       text NOT NULL,
  -- Foto propia. Pisa a la del catálogo externo; hoy nadie la escribe todavía.
  imagen_url   text,
  -- Enlace al catálogo de free-exercise-db (dominio público). El id de allí es
  -- el nombre en inglés con guiones bajos ('Barbell_Squat_To_A_Bench') y las
  -- rutas de sus fotos son siempre '{fedb_id}/0.jpg' y '/1.jpg', así que esta
  -- sola columna da las dos fotos. NULL ⇒ sin enlazar, la UI pinta
  -- "Imagen pendiente".
  fedb_id      text,
  -- El nombre en inglés NO se deriva de `fedb_id`: 35 de los 873 pierden
  -- puntuación al convertir ('Adductor_Groin' es "Adductor/Groin"). Por eso
  -- viaja aparte en vez de calcularse.
  nombre_en    text,
  -- Léxico cerrado de 17 valores de free-exercise-db ('quadriceps', 'lats'…),
  -- en inglés y en minúsculas a propósito: son la clave contra la tabla que
  -- los traduce a los SVG de wger, no texto para enseñar.
  musculos_primarios   text[],
  musculos_secundarios text[],
  es_publico   boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Nombre único dentro del catálogo público; los privados se distinguen por dueño.
CREATE UNIQUE INDEX exercises_nombre_publico_key
  ON exercises (lower(nombre)) WHERE es_publico;
-- Un fedb_id no puede estar en dos filas públicas: sin esto, importar el
-- catálogo de free-exercise-db dos veces lo duplica entero sin quejarse.
CREATE UNIQUE INDEX exercises_fedb_id_key
  ON exercises (fedb_id) WHERE fedb_id IS NOT NULL AND es_publico;
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

-- ── Alias de ejercicio ─────────────────────────────────────────────────────
-- El mismo movimiento se llama distinto en cada gimnasio. Un alias es cómo lo
-- llama UNA persona; no toca el catálogo ni lo ve nadie más.
--
-- Es presentación pura: nada resuelve un id por el alias, no entra en
-- `routine_exercises` ni en `set_logs`, y borrarlo devuelve el nombre del
-- catálogo. Por eso vive en su propia tabla y no en una columna de `exercises`,
-- que es común a todos.

CREATE TABLE exercise_aliases (
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

CREATE INDEX exercise_aliases_exercise_idx ON exercise_aliases (exercise_id);
-- Acompaña a exercises_busqueda_idx: el buscador de /ejercicios mira los dos.
CREATE INDEX exercise_aliases_busqueda_idx
  ON exercise_aliases (unaccent_ci(alias) text_pattern_ops);

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
/* El tramo que le toca a una serie. La barra separa series:

     '10'          → todas las series a 10
     '8-12'        → un rango, todas las series
     '15/12/10/10' → 15, 12, 10 y 10

   La barra y no el guion: '8-12' ya significaba un rango —es lo que lee la
   progresión doble— y sobrecargar el guion lo volvía ambiguo.

   Si hay menos tramos que series se repite el último. Los arrays de Postgres
   empiezan en 1 y `p_serie` viene en base 0, de ahí el +1. */
CREATE FUNCTION tramo_reps(p_reps text, p_serie int DEFAULT 0) RETURNS text
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

-- '45 s' → 45 · '1 min' → 60 · '' → 30. Solo para bloques de tipo 'tiempo'.
CREATE FUNCTION segundos_planificados(p_reps text, p_serie int DEFAULT 0) RETURNS smallint
LANGUAGE sql IMMUTABLE AS $$
  SELECT least(3600, greatest(0,
    coalesce((regexp_match(tramo_reps(p_reps, p_serie), '\d+'))[1]::int, 30)
    * CASE WHEN tramo_reps(p_reps, p_serie) ~* 'min' THEN 60 ELSE 1 END
  ))::smallint;
$$;

-- ── Asignaciones entrenador → alumno ───────────────────────────────────────

-- Qué plan sigue cada alumno. Fuente única de verdad: de aquí salen el próximo
-- día, la adherencia y la semana en curso.
--
-- `coach_id` NULL significa exactamente una cosa: **se lo asignó él mismo**. Un
-- plan propio no se marca poniéndose uno de entrenador — si se admitieran las
-- dos formas, `getPlanActivo()` tendría que distinguirlas y el panel de
-- entrenador contaría gente como alumna de sí misma. De ahí el CHECK.
CREATE TABLE assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id  uuid NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
  coach_id    uuid REFERENCES users (id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  started_on  date NOT NULL DEFAULT current_date,
  ended_on    date,
  notas       text NOT NULL DEFAULT '',
  CONSTRAINT assignments_rango CHECK (ended_on IS NULL OR ended_on >= started_on),
  CONSTRAINT assignments_coach_no_self CHECK (coach_id IS DISTINCT FROM client_id)
);

-- Un alumno solo puede tener una asignación viva de la misma rutina.
CREATE UNIQUE INDEX assignments_activa_key
  ON assignments (client_id, routine_id) WHERE ended_on IS NULL;
CREATE INDEX assignments_coach_idx ON assignments (coach_id) WHERE ended_on IS NULL;

-- ── Invitaciones de entrenador ─────────────────────────────────────────────
-- Cómo se rellena `users.coach_id`. El vínculo lo hacen las dos partes: el
-- entrenador genera un código y el alumno lo canjea, así que nadie acaba con
-- entrenador sin haber escrito nada.

CREATE TABLE coach_invites (
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

CREATE INDEX coach_invites_coach_idx ON coach_invites (coach_id, created_at DESC);

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
-- clave publicable —que viaja en el navegador— puede leer y escribir sus
-- tablas. Vivir en un schema aparte tapaba eso sin querer; aquí hay que decirlo.
--
-- Activar RLS deja la puerta cerrada. Las políticas que la abren, usuario a
-- usuario, están al final del archivo: dependen de `auth.uid()`, así que no
-- pueden escribirse hasta tener el schema `auth` delante.
--
-- El web no depende de ellas: entra por DATABASE_URL con el rol dueño de las
-- tablas, y el dueño salta RLS mientras no se use FORCE ROW LEVEL SECURITY.
-- Quien sí depende es tempo_mobile, que entra por PostgREST con la clave
-- publicable. Si las políticas desaparecen, el móvil deja de ver sus datos.

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_aliases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_days      ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_invites     ENABLE ROW LEVEL SECURITY;
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Supabase Auth
-- ═══════════════════════════════════════════════════════════════════════════
-- El puente entre la identidad (auth.users) y el perfil (public.users), y las
-- políticas que dejan entrar al móvil.
--
-- Esto mismo, en forma de migración para una base que ya tiene datos, está en
-- db/04_auth.sql. Si tocás uno, tocá el otro.
--
-- Los RPC que usa el móvil (empezar_sesion, guardar_series, get_resumen_semana…)
-- viven en tempo_mobile/supabase/migrations/01_mobile_auth_and_rls.sql.

-- ── Trigger y políticas ────────────────────────────────────────────────────
-- Todo esto depende del schema `auth`, que en un Postgres local no existe: si
-- falta, se salta entero y la base de desarrollo levanta igual (sin login).

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
  RAISE NOTICE 'Sin schema `auth` (Postgres local): me salto trigger y políticas.';
  RETURN;
END IF;

-- Perfil automático al registrarse. Lee `raw_user_meta_data`, que es lo que
-- manda el cliente en options.data del signUp.
--
-- El ON CONFLICT es lo que permite que una fila que ya existía —las del seed—
-- se enganche a una cuenta nueva en vez de reventar por el índice de email.
EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $body$
BEGIN
  INSERT INTO public.users (auth_id, email, nombre, role, activo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    (COALESCE(NEW.raw_user_meta_data->>'role', 'alumno'))::public.user_role,
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_id = EXCLUDED.auth_id,
    nombre  = EXCLUDED.nombre,
    role    = EXCLUDED.role,
    activo  = EXCLUDED.activo;
  RETURN NEW;
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;
$fn$;

EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
EXECUTE 'CREATE TRIGGER on_auth_user_created
           AFTER INSERT ON auth.users
           FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';

-- El id interno a partir del JWT. Todas las políticas cuelgan de esto.
EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid AS $body$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$body$ LANGUAGE sql STABLE SECURITY DEFINER;
$fn$;

-- El rol sale de `users` y no del JWT: Supabase copia el rol en
-- `user_metadata` al registrarse y no lo vuelve a tocar, así que un ascenso a
-- admin no se vería hasta que la persona volviera a entrar.
EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean AS $body$
  SELECT coalesce(
    (SELECT role = 'admin' FROM public.users WHERE auth_id = auth.uid() LIMIT 1),
    false);
$body$ LANGUAGE sql STABLE SECURITY DEFINER;
$fn$;

-- Políticas. RLS quedó activada más arriba; esto es lo que abre la puerta,
-- fila a fila. Se escriben con DROP + CREATE para que este bloque sea
-- reejecutable tal cual está en db/04_auth.sql.

-- users: su propia fila, y las de sus alumnos si es entrenador.
EXECUTE 'DROP POLICY IF EXISTS users_select_own ON users';
EXECUTE 'CREATE POLICY users_select_own ON users FOR SELECT TO authenticated
           USING (auth_id = auth.uid() OR coach_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS users_update_own ON users';
EXECUTE 'CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated
           USING (auth_id = auth.uid()) WITH CHECK (auth_id = auth.uid())';

-- exercises: el catálogo común más lo propio. Mismo criterio que getEjercicios().
EXECUTE 'DROP POLICY IF EXISTS exercises_select_visible ON exercises';
EXECUTE 'CREATE POLICY exercises_select_visible ON exercises FOR SELECT TO authenticated
           USING (es_publico OR created_by = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS exercises_insert_own ON exercises';
EXECUTE 'CREATE POLICY exercises_insert_own ON exercises FOR INSERT TO authenticated
           WITH CHECK (created_by = public.current_user_id())';
-- Editar y borrar: lo propio, y para un admin también el catálogo común —
-- que no es de nadie (created_by es NULL en todo lo del seed) y si no,
-- no habría forma de arreglar una errata sin entrar por SQL.
-- SELECT no se abre: poder arreglar lo compartido no es poder leer lo privado
-- de cada persona.
EXECUTE 'DROP POLICY IF EXISTS exercises_update_own ON exercises';
EXECUTE 'CREATE POLICY exercises_update_own ON exercises FOR UPDATE TO authenticated
           USING (created_by = public.current_user_id() OR public.es_admin())
           WITH CHECK (created_by = public.current_user_id() OR public.es_admin())';
EXECUTE 'DROP POLICY IF EXISTS exercises_delete_own ON exercises';
EXECUTE 'CREATE POLICY exercises_delete_own ON exercises FOR DELETE TO authenticated
           USING (created_by = public.current_user_id() OR public.es_admin())';

-- exercise_aliases: lo mío, más lo de quien escribió una rutina que tengo
-- asignada y viva. Ese segundo caso es el que hace que el alias del entrenador
-- llegue al alumno, y es el mismo criterio que aplica el web al resolver el
-- nombre — escrito como política para que el móvil pueda resolverlo solo.
--
-- Escribir, solo lo mío: el alias de otro no se toca nunca, ni siendo admin.
-- Un admin arregla el catálogo común, que es de todos; un alias es de uno.
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

-- routines: propias, o escritas por uno como entrenador.
EXECUTE 'DROP POLICY IF EXISTS routines_select_own ON routines';
EXECUTE 'CREATE POLICY routines_select_own ON routines FOR SELECT TO authenticated
           USING (owner_id = public.current_user_id() OR author_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS routines_insert_own ON routines';
EXECUTE 'CREATE POLICY routines_insert_own ON routines FOR INSERT TO authenticated
           WITH CHECK (owner_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS routines_update_own ON routines';
EXECUTE 'CREATE POLICY routines_update_own ON routines FOR UPDATE TO authenticated
           USING (owner_id = public.current_user_id())
           WITH CHECK (owner_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS routines_delete_own ON routines';
EXECUTE 'CREATE POLICY routines_delete_own ON routines FOR DELETE TO authenticated
           USING (owner_id = public.current_user_id())';

-- routine_days y routine_exercises: cuelgan de la rutina.
EXECUTE 'DROP POLICY IF EXISTS routine_days_select_own ON routine_days';
EXECUTE 'CREATE POLICY routine_days_select_own ON routine_days FOR SELECT TO authenticated
           USING (routine_id IN (SELECT id FROM routines
                  WHERE owner_id = public.current_user_id() OR author_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_days_insert_own ON routine_days';
EXECUTE 'CREATE POLICY routine_days_insert_own ON routine_days FOR INSERT TO authenticated
           WITH CHECK (routine_id IN (SELECT id FROM routines WHERE owner_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_days_update_own ON routine_days';
EXECUTE 'CREATE POLICY routine_days_update_own ON routine_days FOR UPDATE TO authenticated
           USING (routine_id IN (SELECT id FROM routines WHERE owner_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_days_delete_own ON routine_days';
EXECUTE 'CREATE POLICY routine_days_delete_own ON routine_days FOR DELETE TO authenticated
           USING (routine_id IN (SELECT id FROM routines WHERE owner_id = public.current_user_id()))';

EXECUTE 'DROP POLICY IF EXISTS routine_exercises_select_own ON routine_exercises';
EXECUTE 'CREATE POLICY routine_exercises_select_own ON routine_exercises FOR SELECT TO authenticated
           USING (routine_day_id IN (SELECT d.id FROM routine_days d JOIN routines r ON r.id = d.routine_id
                  WHERE r.owner_id = public.current_user_id() OR r.author_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_exercises_insert_own ON routine_exercises';
EXECUTE 'CREATE POLICY routine_exercises_insert_own ON routine_exercises FOR INSERT TO authenticated
           WITH CHECK (routine_day_id IN (SELECT d.id FROM routine_days d JOIN routines r ON r.id = d.routine_id
                       WHERE r.owner_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_exercises_update_own ON routine_exercises';
EXECUTE 'CREATE POLICY routine_exercises_update_own ON routine_exercises FOR UPDATE TO authenticated
           USING (routine_day_id IN (SELECT d.id FROM routine_days d JOIN routines r ON r.id = d.routine_id
                  WHERE r.owner_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS routine_exercises_delete_own ON routine_exercises';
EXECUTE 'CREATE POLICY routine_exercises_delete_own ON routine_exercises FOR DELETE TO authenticated
           USING (routine_day_id IN (SELECT d.id FROM routine_days d JOIN routines r ON r.id = d.routine_id
                  WHERE r.owner_id = public.current_user_id()))';

-- assignments: como alumno se lee, como entrenador se escribe.
EXECUTE 'DROP POLICY IF EXISTS assignments_select_own ON assignments';
EXECUTE 'CREATE POLICY assignments_select_own ON assignments FOR SELECT TO authenticated
           USING (client_id = public.current_user_id() OR coach_id = public.current_user_id())';
-- Escribe el entrenador del alumno, o el propio alumno cuando el plan es suyo
-- (la fila con `coach_id IS NULL`).
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

-- workout_sessions y set_logs: solo lo propio. El historial no se comparte ni
-- con el entrenador por esta puerta.
EXECUTE 'DROP POLICY IF EXISTS workout_sessions_select_own ON workout_sessions';
EXECUTE 'CREATE POLICY workout_sessions_select_own ON workout_sessions FOR SELECT TO authenticated
           USING (user_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS workout_sessions_insert_own ON workout_sessions';
EXECUTE 'CREATE POLICY workout_sessions_insert_own ON workout_sessions FOR INSERT TO authenticated
           WITH CHECK (user_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS workout_sessions_update_own ON workout_sessions';
EXECUTE 'CREATE POLICY workout_sessions_update_own ON workout_sessions FOR UPDATE TO authenticated
           USING (user_id = public.current_user_id())
           WITH CHECK (user_id = public.current_user_id())';
EXECUTE 'DROP POLICY IF EXISTS workout_sessions_delete_own ON workout_sessions';
EXECUTE 'CREATE POLICY workout_sessions_delete_own ON workout_sessions FOR DELETE TO authenticated
           USING (user_id = public.current_user_id())';

EXECUTE 'DROP POLICY IF EXISTS set_logs_select_own ON set_logs';
EXECUTE 'CREATE POLICY set_logs_select_own ON set_logs FOR SELECT TO authenticated
           USING (session_id IN (SELECT id FROM workout_sessions WHERE user_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS set_logs_insert_own ON set_logs';
EXECUTE 'CREATE POLICY set_logs_insert_own ON set_logs FOR INSERT TO authenticated
           WITH CHECK (session_id IN (SELECT id FROM workout_sessions WHERE user_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS set_logs_update_own ON set_logs';
EXECUTE 'CREATE POLICY set_logs_update_own ON set_logs FOR UPDATE TO authenticated
           USING (session_id IN (SELECT id FROM workout_sessions WHERE user_id = public.current_user_id()))';
EXECUTE 'DROP POLICY IF EXISTS set_logs_delete_own ON set_logs';
EXECUTE 'CREATE POLICY set_logs_delete_own ON set_logs FOR DELETE TO authenticated
           USING (session_id IN (SELECT id FROM workout_sessions WHERE user_id = public.current_user_id()))';

-- personal_records: solo lectura. Las marcas las escribe registrar_prs(), que
-- corre como SECURITY DEFINER al cerrar la sesión.
EXECUTE 'DROP POLICY IF EXISTS personal_records_select_own ON personal_records';
EXECUTE 'CREATE POLICY personal_records_select_own ON personal_records FOR SELECT TO authenticated
           USING (user_id = public.current_user_id())';

-- coach_invites: el entrenador manda sobre sus propios códigos.
--
-- El canje NO tiene política a propósito. Para canjear hay que leer la fila de
-- otro —la del entrenador— y una política que lo permitiera dejaría enumerar
-- códigos ajenos desde el navegador. En el web el canje lo hace una server
-- action, que entra con el rol dueño y comprueba ella misma.
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
