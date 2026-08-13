-- ═══════════════════════════════════════════════════════════════════════════
-- Tempo — datos semilla (los del prototipo de diseño).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/99_seed.sql
--
-- Idempotente: se puede volver a correr, borra lo suyo y lo vuelve a insertar.
-- El historial se genera relativo a now(), así que las gráficas tienen sentido
-- se ejecute el día que se ejecute.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

BEGIN;

TRUNCATE personal_records, set_logs, workout_sessions, assignments,
         routine_exercises, routine_days, routines, exercises, users
  RESTART IDENTITY CASCADE;

-- ── Usuarios ───────────────────────────────────────────────────────────────

INSERT INTO users (id, email, nombre, role, coach_id) VALUES
  ('22222222-2222-2222-2222-222222222222', 'laura@tempo.gym',  'Laura Ferrán',    'entrenador', NULL),
  ('11111111-1111-1111-1111-111111111111', 'marco@tempo.gym',  'Marco Duarte',    'alumno', '22222222-2222-2222-2222-222222222222');

-- ── Catálogo de ejercicios ─────────────────────────────────────────────────

INSERT INTO exercises (nombre, grupo, equipo) VALUES
  -- Pecho
  ('Press banca',                  'Pecho',    'Barra'),
  ('Press banca inclinado',        'Pecho',    'Barra'),
  ('Press inclinado mancuernas',   'Pecho',    'Mancuernas'),
  ('Press banca con mancuernas',   'Pecho',    'Mancuernas'),
  ('Press declinado',              'Pecho',    'Barra'),
  ('Aperturas en polea',           'Pecho',    'Polea'),
  ('Cruce de poleas',              'Pecho',    'Polea'),
  ('Pec deck',                     'Pecho',    'Máquina'),
  ('Fondos en paralelas',          'Pecho',    'Peso corporal'),
  ('Aperturas inclinadas con mancuernas',              'Pecho',  'Mancuernas'),

  -- Espalda
  ('Peso muerto',                  'Espalda',  'Barra'),
  ('Peso muerto rumano',           'Espalda',  'Barra'),
  ('Peso muerto sumo',             'Espalda',  'Barra'),
  ('Dominadas',                    'Espalda',  'Peso corporal'),
  ('Dominadas lastradas',          'Espalda',  'Peso corporal'),
  ('Remo con barra',               'Espalda',  'Barra'),
  ('Remo en T',                    'Espalda',  'Barra'),
  ('Remo Pendlay',                 'Espalda',  'Barra'),
  ('Remo con mancuerna',           'Espalda',  'Mancuernas'),
  ('Remo sentado en polea',        'Espalda',  'Polea'),
  ('Jalón al pecho',               'Espalda',  'Polea'),
  ('Pull-over en polea',           'Espalda',  'Polea'),

  -- Pierna
  ('Sentadilla trasera',           'Pierna',   'Barra'),
  ('Sentadilla frontal',           'Pierna',   'Barra'),
  ('Sentadilla búlgara',           'Pierna',   'Mancuernas'),
  ('Prensa 45°',                   'Pierna',   'Máquina'),
  ('Extensión de cuádriceps',      'Pierna',   'Máquina'),
  ('Curl femoral tumbado',         'Pierna',   'Máquina'),
  ('Curl femoral sentado',         'Pierna',   'Máquina'),
  ('Abducción de cadera',          'Pierna',   'Máquina'),
  ('Zancadas con mancuernas',      'Pierna',   'Mancuernas'),
  ('Peso muerto a una pierna',     'Pierna',   'Mancuernas'),
  ('Elevación de gemelo',          'Pierna',   'Máquina'),
  ('Hip thrust',                   'Pierna',   'Barra'),
  ('Bridge 3 apoyo inferior',                          'Pierna', 'Peso corporal'),
  ('AMI - Glúteos 1 pierna 3 apoyos',                  'Pierna', 'Máquina'),

  -- Hombro
  ('Press militar',                'Hombro',   'Barra'),
  ('Press militar con mancuernas', 'Hombro',   'Mancuernas'),
  ('Press Arnold',                 'Hombro',   'Mancuernas'),
  ('Elevaciones laterales',        'Hombro',   'Mancuernas'),
  ('Elevación frontal',            'Hombro',   'Mancuernas'),
  ('Elevación posterior (pájaros)','Hombro',   'Mancuernas'),
  ('Face pull',                    'Hombro',   'Polea'),

  -- Brazo
  ('Curl con barra Z',             'Brazo',    'Barra Z'),
  ('Curl de bíceps con mancuernas','Brazo',    'Mancuernas'),
  ('Curl martillo',                'Brazo',    'Mancuernas'),
  ('Curl concentrado',             'Brazo',    'Mancuernas'),
  ('Extensión tríceps en polea',   'Brazo',    'Polea'),
  ('Press francés',                'Brazo',    'Barra Z'),
  ('Press francés en polea',       'Brazo',    'Polea'),
  ('Fondos en banco',              'Brazo',    'Peso corporal'),
  ('Patada de tríceps',            'Brazo',    'Mancuernas'),
  ('Curl bíceps en banco Scott',                       'Brazo',  'Barra Z'),

  -- Core
  ('Plancha con lastre',           'Core',     'Peso corporal'),
  ('Rueda abdominal',              'Core',     'Rueda'),
  ('Crunch en polea',              'Core',     'Polea'),
  ('Elevación de piernas colgado', 'Core',     'Peso corporal'),
  ('Russian twist',                'Core',     'Peso corporal'),
  ('Abdominales en máquina',       'Core',     'Máquina'),
  ('Elevación de pierna alternativa en plancha', 'Core', 'Peso corporal'),
  ('Crunch abdominal con carga por encima de la cabeza','Core',  'Mancuernas'),
  ('Flexión de cadera en plancha lateral',             'Core',   'Peso corporal'),
  ('Encogimiento abdominal',                           'Core',   'Peso corporal'),
  ('Escalador',                                        'Core',   'Peso corporal'),
  ('Crunch con piernas elevadas',                      'Core',   'Peso corporal'),

  -- Trapecio
  ('Encogimientos con barra',      'Trapecio', 'Barra'),
  ('Encogimientos con mancuernas', 'Trapecio', 'Mancuernas'),

  -- Antebrazo
  ('Curl de muñeca',               'Antebrazo','Barra'),
  ('Farmer walk',                  'Antebrazo','Mancuernas');

-- ── Rutinas ────────────────────────────────────────────────────────────────

INSERT INTO routines (id, nombre, descripcion, nivel, semanas, status, owner_id, author_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001',
   'Fuerza intermedia 5×',
   'Bloque de doce semanas con progresión lineal en los básicos y trabajo accesorio en volumen. Sube 2,5 kg cuando completes todas las series.',
   'Intermedio', 12, 'activa',
   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),

  ('aaaaaaaa-0000-0000-0000-000000000002',
   'Push / Pull / Legs',
   'Rotación clásica de seis días con dos ciclos por semana.',
   'Avanzado', 8, 'activa',
   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),

  ('aaaaaaaa-0000-0000-0000-000000000003',
   'Full body 3×',
   'Tres sesiones completas para semanas con poco tiempo.',
   'Principiante', 6, 'guardada',
   '11111111-1111-1111-1111-111111111111', NULL),

  ('aaaaaaaa-0000-0000-0000-000000000004',
   'Hipertrofia superior',
   'Enfoque en torso, seis series por grupo y sesión.',
   'Intermedio', 10, 'guardada',
   '11111111-1111-1111-1111-111111111111', NULL),

  ('aaaaaaaa-0000-0000-0000-000000000005',
   'Descarga activa',
   'Semana de descarga al 60% del volumen habitual.',
   'Todos', 1, 'guardada',
   '11111111-1111-1111-1111-111111111111', NULL),

  ('aaaaaaaa-0000-0000-0000-000000000006',
   'Preparación media maratón',
   'Fuerza de apoyo para bloque de carrera.',
   'Intermedio', 10, 'borrador',
   '11111111-1111-1111-1111-111111111111', NULL);

-- ── Días de "Fuerza intermedia 5×" ─────────────────────────────────────────

INSERT INTO routine_days (id, routine_id, orden, codigo, nombre, titulo, subtitulo, duracion_min, descanso_defecto_s, progresion) VALUES
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 0, 'A', 'Tirón',
   'Día A — Tirón',           'Espalda, bíceps, cadena posterior', 65, 120, 'lineal'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 'B', 'Empuje',
   'Día B — Empuje',          'Pecho, hombro, tríceps',            62,  90, 'lineal'),
  ('bbbbbbbb-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001', 2, 'C', 'Pierna',
   'Día C — Pierna',          'Cuádriceps, femoral, gemelo',       70, 120, 'lineal'),
  ('bbbbbbbb-0000-0000-0000-00000000000d', 'aaaaaaaa-0000-0000-0000-000000000001', 3, 'D', 'Torso',
   'Día D — Torso completo',  'Volumen medio, series al fallo controlado', 55, 90, 'doble'),
  ('bbbbbbbb-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-000000000001', 4, 'E', 'Accesorio',
   'Día E — Accesorio y core','Sesión corta, prehabilitación',     40,  60, 'manual');

-- Ejercicios por día. `carga_kg` es la carga objetivo de la semana en curso.
INSERT INTO routine_exercises (routine_day_id, exercise_id, orden, series, tipo, reps, carga_kg, carga_texto, descanso_s)
SELECT d.id, e.id, v.orden, v.series, v.tipo::effort_kind, v.reps, v.carga_kg, v.carga_texto, v.descanso_s
FROM (VALUES
  -- Día A
  ('A', 'Peso muerto',                 0, 4, 'reps',   '5',    132.5, NULL,           180),
  ('A', 'Dominadas lastradas',         1, 4, 'reps',   '6',     17.5, '+17,5 kg',     150),
  ('A', 'Remo con barra',              2, 4, 'reps',   '8',     70.0, NULL,           120),
  ('A', 'Jalón al pecho',              3, 3, 'reps',   '12',    55.0, NULL,            90),
  ('A', 'Curl con barra Z',            4, 3, 'reps',   '12',    27.5, NULL,            60),
  -- Día B
  ('B', 'Press banca',                 0, 4, 'reps',   '8',     72.5, NULL,           150),
  ('B', 'Press militar',               1, 4, 'reps',   '8',     42.5, NULL,           120),
  ('B', 'Press inclinado mancuernas',  2, 3, 'reps',   '10',    24.0, NULL,            90),
  ('B', 'Fondos en paralelas',         3, 3, 'reps',   '10',     0.0, 'Peso corp.',    90),
  ('B', 'Extensión tríceps en polea',  4, 3, 'reps',   '12',    27.5, NULL,            60),
  -- Día C
  ('C', 'Sentadilla trasera',          0, 5, 'reps',   '5',    105.0, NULL,           180),
  ('C', 'Prensa 45°',                  1, 4, 'reps',   '10',   180.0, NULL,           120),
  ('C', 'Curl femoral tumbado',        2, 4, 'reps',   '12',    45.0, NULL,            90),
  ('C', 'Zancadas con mancuernas',     3, 3, 'reps',   '12',    20.0, NULL,            90),
  ('C', 'Elevación de gemelo',         4, 4, 'reps',   '15',    70.0, NULL,            60),
  -- Día D
  ('D', 'Press banca inclinado',       0, 4, 'reps',   '8',     60.0, NULL,           120),
  ('D', 'Remo en punta',               1, 4, 'reps',   '10',    50.0, NULL,           120),
  ('D', 'Elevaciones laterales',       2, 4, 'reps',   '15',    10.0, NULL,            60),
  ('D', 'Face pull',                   3, 3, 'reps',   '15',    25.0, NULL,            60),
  -- Día E — la plancha es el único bloque por tiempo del seed.
  ('E', 'Hip thrust',                  0, 4, 'reps',   '10',    90.0, NULL,            90),
  ('E', 'Remo con mancuerna',          1, 3, 'reps',   '12',    32.0, NULL,            75),
  ('E', 'Plancha con lastre',          2, 3, 'tiempo', '45 s',  10.0, '+10 kg',        60),
  ('E', 'Rueda abdominal',             3, 3, 'reps',   '12',     0.0, 'Peso corp.',    60)
) AS v (codigo, ejercicio, orden, series, tipo, reps, carga_kg, carga_texto, descanso_s)
JOIN routine_days d
  ON d.routine_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND d.codigo = v.codigo
JOIN exercises e ON e.nombre = v.ejercicio;

-- Días esqueleto para el resto de rutinas: sin ejercicios todavía, pero con el
-- número de días correcto (de ahí sale la adherencia esperada de cada alumno).
INSERT INTO routine_days (routine_id, orden, codigo, nombre, titulo, subtitulo, duracion_min)
SELECT r.id,
       g - 1,
       chr(64 + g),
       'Sesión ' || g,
       'Día ' || chr(64 + g) || ' — Sesión ' || g,
       'Plantilla pendiente de detallar',
       50
FROM routines r
CROSS JOIN LATERAL generate_series(1, CASE r.nombre
    WHEN 'Push / Pull / Legs'         THEN 6
    WHEN 'Full body 3×'               THEN 3
    WHEN 'Hipertrofia superior'       THEN 4
    WHEN 'Descarga activa'            THEN 4
    WHEN 'Preparación media maratón'  THEN 2
    ELSE 0
  END) AS g
WHERE r.id <> 'aaaaaaaa-0000-0000-0000-000000000001';

-- ── Asignaciones ───────────────────────────────────────────────────────────

-- Laura solo tiene a Marco: el panel de entrenador sale con una fila.
INSERT INTO assignments (routine_id, coach_id, client_id, started_on)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', (current_date - 35));

-- ═══════════════════════════════════════════════════════════════════════════
-- Historial: 12 semanas de entrenamientos de Marco.
-- Las cargas suben ~2% por semana, así que el gráfico de volumen crece igual
-- que en el prototipo (≈11.200 kg la primera semana → ≈18.200 kg la última).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user   uuid := '11111111-1111-1111-1111-111111111111';
  v_semana int;
  v_dia    record;
  v_ses    uuid;
  v_ini    timestamptz;
  v_factor numeric;
  v_serie  int;
  v_kg     numeric;
  v_reps   int;
  v_bloque int;
  v_ex     record;
BEGIN
  FOR v_semana IN 0..11 LOOP
    -- La carga sube un escalón cada tres semanas (0,62 → 1,00 del objetivo),
    -- con microdescargas en las semanas 2, 5 y 8: así el gráfico de volumen
    -- tiene la forma de sierra ascendente del diseño y los PRs caen en un
    -- tercio de las sesiones, no en todas.
    v_factor := 0.62 + 0.1267 * floor(v_semana / 3.0);
    IF v_semana IN (2, 5, 8) THEN
      v_factor := v_factor * 0.92;
    END IF;

    FOR v_dia IN
      SELECT * FROM routine_days
      WHERE routine_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      ORDER BY orden
    LOOP
      -- Adherencia realista: se salta el día E una de cada tres semanas.
      CONTINUE WHEN v_dia.codigo = 'E' AND v_semana % 3 = 0;

      v_ini := date_trunc('week', now())
               - make_interval(weeks => 11 - v_semana)
               + make_interval(days => v_dia.orden, hours => 18, mins => 30);

      -- Nada en el futuro.
      CONTINUE WHEN v_ini > now() - interval '2 hours';

      INSERT INTO workout_sessions (user_id, routine_id, routine_day_id, titulo, status, started_at, ended_at)
      VALUES (v_user, 'aaaaaaaa-0000-0000-0000-000000000001', v_dia.id, v_dia.titulo, 'terminada',
              v_ini, v_ini + make_interval(mins => coalesce(v_dia.duracion_min, 55) + (v_semana % 7)))
      RETURNING id INTO v_ses;

      v_bloque := 0;
      FOR v_ex IN
        SELECT re.*, ex.nombre FROM routine_exercises re
        JOIN exercises ex ON ex.id = re.exercise_id
        WHERE re.routine_day_id = v_dia.id ORDER BY re.orden
      LOOP
        FOR v_serie IN 1..v_ex.series LOOP
          -- Carga redondeada al múltiplo de 2,5 kg más cercano.
          v_kg := round((coalesce(v_ex.carga_kg, 0) * v_factor) / 2.5) * 2.5;

          IF v_ex.tipo = 'tiempo' THEN
            -- Sin repeticiones inventadas: aguanta unos segundos menos según
            -- avanza el ejercicio, y no aporta volumen.
            INSERT INTO set_logs (session_id, exercise_id, routine_exercise_id,
                                  bloque, orden, kg, reps, segundos, done_at)
            VALUES (v_ses, v_ex.exercise_id, v_ex.id, v_bloque, v_serie, v_kg, 0,
                    greatest(5, segundos_planificados(v_ex.reps) - (v_serie - 1) * 5),
                    v_ini + make_interval(mins => v_bloque * 11 + v_serie * 2));
          ELSE
            -- Las últimas series caen una o dos reps.
            v_reps := greatest(1,
              reps_planificadas(v_ex.reps) - CASE WHEN v_serie > 2 THEN 1 ELSE 0 END);

            INSERT INTO set_logs (session_id, exercise_id, routine_exercise_id,
                                  bloque, orden, kg, reps, done_at)
            VALUES (v_ses, v_ex.exercise_id, v_ex.id, v_bloque, v_serie, v_kg, v_reps,
                    v_ini + make_interval(mins => v_bloque * 11 + v_serie * 2));
          END IF;
        END LOOP;
        v_bloque := v_bloque + 1;
      END LOOP;

      PERFORM registrar_prs(v_ses);
    END LOOP;
  END LOOP;
END $$;

-- ── Sesión en curso de Marco (Día B — Empuje) ──────────────────────────────
-- Reproduce la pantalla del prototipo: cronómetro corriendo, series aún sin
-- confirmar y la columna "Anterior" resuelta desde el historial de arriba.

DO $$
DECLARE
  v_dia   uuid := 'bbbbbbbb-0000-0000-0000-00000000000b';
  v_ses   uuid;
  v_ex    record;
  v_bloque int := 0;
  v_serie int;
BEGIN
  INSERT INTO workout_sessions (user_id, routine_id, routine_day_id, titulo, status, started_at)
  VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
          v_dia, 'Día B — Empuje', 'en_curso', now() - interval '30 minutes 47 seconds')
  RETURNING id INTO v_ses;

  FOR v_ex IN
    SELECT * FROM routine_exercises WHERE routine_day_id = v_dia ORDER BY orden
  LOOP
    FOR v_serie IN 1..v_ex.series LOOP
      INSERT INTO set_logs (session_id, exercise_id, routine_exercise_id,
                            bloque, orden, kg, reps, segundos, done_at)
      VALUES (v_ses, v_ex.exercise_id, v_ex.id, v_bloque, v_serie,
              coalesce(v_ex.carga_kg, 0),
              CASE WHEN v_ex.tipo = 'tiempo' THEN 0 ELSE reps_planificadas(v_ex.reps) END,
              CASE WHEN v_ex.tipo = 'tiempo' THEN segundos_planificados(v_ex.reps) END,
              NULL);
    END LOOP;
    v_bloque := v_bloque + 1;
  END LOOP;
END $$;

COMMIT;

-- Comprobación rápida.
SELECT
  (SELECT count(*) FROM users)            AS usuarios,
  (SELECT count(*) FROM exercises)        AS ejercicios,
  (SELECT count(*) FROM routines)         AS rutinas,
  (SELECT count(*) FROM workout_sessions) AS sesiones,
  (SELECT count(*) FROM set_logs)         AS series,
  (SELECT count(*) FROM personal_records) AS records;
